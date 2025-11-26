"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoyHappyStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv.config({ path: './.env' });
// Importar constantes de nombres de tablas (única fuente de verdad)
const TABLE_NAMES = require('../../shared/table-names.cjs');
// ==========================================
// FUNCIÓN: AUTO-DISCOVERY DE LAMBDAS
// ==========================================
/**
 * Descubre automáticamente todas las lambdas en el directorio especificado
 * y extrae su metadata para auto-configuración
 */
function discoverLambdas(lambdaDir) {
    const absolutePath = path.resolve(__dirname, lambdaDir);
    console.log(`\n🔍 Discovering lambdas in: ${absolutePath}`);
    if (!fs.existsSync(absolutePath)) {
        console.warn(`⚠️  Lambda directory not found: ${absolutePath}`);
        return [];
    }
    const files = fs.readdirSync(absolutePath)
        .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.'));
    console.log(`📦 Found ${files.length} lambda files`);
    const discovered = [];
    for (const file of files) {
        const name = file.replace('.js', '');
        const filePath = path.join(absolutePath, file);
        try {
            // Intentar cargar el módulo para leer metadata
            // NOTA: En tiempo de CDK synth, esto requiere que los módulos sean válidos
            // Si hay errores de require (faltan deps), usamos metadata por defecto
            delete require.cache[require.resolve(filePath)];
            const module = require(filePath);
            const metadata = module.metadata || {
                route: `/${name}`,
                methods: ['GET', 'POST'],
                auth: true,
                roles: ['*'],
                profile: 'medium',
                tables: []
            };
            discovered.push({
                name,
                fileName: file,
                filePath,
                metadata
            });
            console.log(`  ✅ ${name}: ${metadata.route} [${metadata.profile}] ${metadata.auth ? '🔒' : '🌐'}`);
        }
        catch (error) {
            console.warn(`  ⚠️  Could not load metadata for ${file}:`, error.message);
            // Usar metadata por defecto si no se puede cargar
            const defaultMetadata = {
                route: `/${name}`,
                methods: ['GET', 'POST'],
                auth: true,
                roles: ['*'],
                profile: 'medium',
                tables: []
            };
            discovered.push({
                name,
                fileName: file,
                filePath,
                metadata: defaultMetadata
            });
            console.log(`  ⚠️  ${name}: Using default metadata`);
        }
    }
    console.log(`\n✅ Discovery complete: ${discovered.length} lambdas configured\n`);
    return discovered;
}
class BoyHappyStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ----------------------------
        // Buckets S3
        // ----------------------------
        const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
            bucketName: `boyhappy-images-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            cors: [{
                    allowedOrigins: ['*'],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag']
                }]
        });
        const materialesBucket = new s3.Bucket(this, 'MaterialesBucket', {
            bucketName: `boyhappy-materiales-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            cors: [{
                    allowedOrigins: ['*'],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedHeaders: ['*']
                }]
        });
        // Bucket para backups automáticos
        // FREE TIER: Sin versionado para evitar costos adicionales
        const backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
            bucketName: `boyhappy-backups-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.RETAIN, // RETAIN para no perder backups
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false, // FREE TIER: Desactivado para evitar costos
            lifecycleRules: [{
                    // Retener solo 7 días de backups para mantenerse en Free Tier
                    expiration: cdk.Duration.days(7)
                }]
        });
        // Bucket para frontend estático (HTML/CSS/JS)
        // FREE TIER: S3 Static Website Hosting (sin CloudFront para evitar costos)
        const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `boyhappy-frontend-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            // Configuración para Static Website Hosting (público)
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html', // SPA fallback
            publicReadAccess: true, // Permite acceso público para Static Website
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicPolicy: false,
                blockPublicAcls: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false
            }),
            cors: [{
                    allowedOrigins: ['*'],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedHeaders: ['*']
                }]
        });
        // ----------------------------
        // TABLAS DYNAMODB OPTIMIZADAS
        // ----------------------------
        // 1. TABLA USUARIOS
        // FREE TIER: PROVISIONED mode con 5 RCU/WCU (gratis permanentemente)
        const usuariosTable = new dynamodb.Table(this, 'UsuariosTable', {
            tableName: TABLE_NAMES.USUARIOS_TABLE,
            partitionKey: { name: 'rut', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 5, // FREE TIER: 25 RCU totales compartidas entre todas las tablas
            writeCapacity: 5, // FREE TIER: 25 WCU totales compartidas entre todas las tablas
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        usuariosTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'correo', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 2. TABLA COMUNICACIONES (fusiona Anuncios + Eventos + Matriculas)
        const comunicacionesTable = new dynamodb.Table(this, 'ComunicacionesTable', {
            tableName: TABLE_NAMES.COMUNICACIONES_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 3,
            writeCapacity: 3,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para filtrar por tipo y fecha
        comunicacionesTable.addGlobalSecondaryIndex({
            indexName: 'TipoFechaIndex',
            partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // GSI para filtrar matrículas por estado
        comunicacionesTable.addGlobalSecondaryIndex({
            indexName: 'EstadoIndex',
            partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 3. TABLA ASISTENCIA
        const asistenciaTable = new dynamodb.Table(this, 'AsistenciaTable', {
            tableName: TABLE_NAMES.ASISTENCIA_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 3,
            writeCapacity: 3,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        asistenciaTable.addGlobalSecondaryIndex({
            indexName: 'CursoFechaIndex',
            partitionKey: { name: 'curso', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        asistenciaTable.addGlobalSecondaryIndex({
            indexName: 'AlumnoIndex',
            partitionKey: { name: 'rutAlumno', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 4. TABLA RECURSOS ACADEMICOS (fusiona Notas + Materiales + Bitácora + Categorías)
        const recursosAcademicosTable = new dynamodb.Table(this, 'RecursosAcademicosTable', {
            tableName: TABLE_NAMES.RECURSOS_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 3,
            writeCapacity: 3,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para consultas por alumno (notas)
        recursosAcademicosTable.addGlobalSecondaryIndex({
            indexName: 'AlumnoIndex',
            partitionKey: { name: 'rutAlumno', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // GSI para consultas por curso y asignatura
        recursosAcademicosTable.addGlobalSecondaryIndex({
            indexName: 'CursoAsignaturaIndex',
            partitionKey: { name: 'curso', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'asignatura', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // GSI para jerarquía de categorías (parent-child)
        recursosAcademicosTable.addGlobalSecondaryIndex({
            indexName: 'ParentCategoriaIndex',
            partitionKey: { name: 'parentId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ✅ GSI para buscar solo por ID (sin tipo) - Permite GetCommand con solo {id}
        // NOTA: Aunque se puede usar GetCommand con {id, tipo}, este GSI permite queries más flexibles
        // recursosAcademicosTable.addGlobalSecondaryIndex({
        //   indexName: 'IdIndex',
        //   partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        //   projectionType: dynamodb.ProjectionType.ALL,
        // });
        // COMENTADO: En realidad no es necesario un GSI para GetCommand.
        // GetCommand funciona con partition key + sort key: {id, tipo}
        // El backend fue actualizado para funcionar así.
        // 5. TABLA RETROALIMENTACION (unifica todas las observaciones)
        const retroalimentacionTable = new dynamodb.Table(this, 'RetroalimentacionTable', {
            tableName: TABLE_NAMES.RETROALIMENTACION_TABLE,
            partitionKey: { name: 'rutUsuario', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para consultas por origen y fecha
        retroalimentacionTable.addGlobalSecondaryIndex({
            indexName: 'OrigenFechaIndex',
            partitionKey: { name: 'origen', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 6. TABLA AGENDA FONOAUDIOLOGIA (renombrada)
        const agendaFonoTable = new dynamodb.Table(this, 'AgendaFonoTable', {
            tableName: TABLE_NAMES.AGENDA_TABLE,
            partitionKey: { name: 'fechaHora', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 7. TABLA CONFIGURACION
        const configuracionTable = new dynamodb.Table(this, 'ConfiguracionTable', {
            tableName: TABLE_NAMES.CONFIGURACION_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 7.5. TABLA MATERIALCATEGORIAS (Relación Many-to-Many)
        const materialCategoriasTable = new dynamodb.Table(this, 'MaterialCategoriasTable', {
            tableName: TABLE_NAMES.MATERIAL_CATEGORIAS_TABLE,
            partitionKey: { name: 'materialId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'categoriaId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling para mejor escalabilidad
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI inverso para consultar materiales por categoría
        materialCategoriasTable.addGlobalSecondaryIndex({
            indexName: 'CategoriaIndex',
            partitionKey: { name: 'categoriaId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'materialId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 8. TABLA INFORMES (NUEVA - FASE 5)
        const informesTable = new dynamodb.Table(this, 'InformesTable', {
            tableName: TABLE_NAMES.INFORMES_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        informesTable.addGlobalSecondaryIndex({
            indexName: 'AlumnoIndex',
            partitionKey: { name: 'rutAlumno', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        informesTable.addGlobalSecondaryIndex({
            indexName: 'TipoIndex',
            partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 9. TABLA REPORTES (NUEVA - FASE 9)
        const reportesTable = new dynamodb.Table(this, 'ReportesTable', {
            tableName: TABLE_NAMES.REPORTES_TABLE,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fechaGeneracion', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        reportesTable.addGlobalSecondaryIndex({
            indexName: 'TipoIndex',
            partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'fechaGeneracion', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 10. TABLA APODERADOS (NUEVA - Relaciones Apoderado-Alumno)
        const apoderadosTable = new dynamodb.Table(this, 'ApoderadosTable', {
            tableName: TABLE_NAMES.APODERADOS_TABLE,
            partitionKey: { name: 'rut', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para búsqueda por correo
        apoderadosTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'correo', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 11. TABLA APODERADO-ALUMNO (Relación N:N)
        const apoderadoAlumnoTable = new dynamodb.Table(this, 'ApoderadoAlumnoTable', {
            tableName: TABLE_NAMES.APODERADO_ALUMNO_TABLE,
            partitionKey: { name: 'apoderadoRut', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'alumnoRut', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para queries inversas (buscar apoderados por alumno)
        apoderadoAlumnoTable.addGlobalSecondaryIndex({
            indexName: 'AlumnoIndex',
            partitionKey: { name: 'alumnoRut', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'apoderadoRut', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 12. TABLA PROFESOR-CURSO (Relación 1:N con tipos)
        const profesorCursoTable = new dynamodb.Table(this, 'ProfesorCursoTable', {
            tableName: TABLE_NAMES.PROFESOR_CURSO_TABLE,
            partitionKey: { name: 'profesorRut', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'cursoTipo', type: dynamodb.AttributeType.STRING }, // "1A#jefe" o "1A#asignatura#Matemáticas"
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // GSI para listar profesores de un curso
        profesorCursoTable.addGlobalSecondaryIndex({
            indexName: 'CursoIndex',
            partitionKey: { name: 'curso', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ----------------------------
        // Lambda Layer con dependencias comunes
        // ----------------------------
        const commonLayer = new lambda.LayerVersion(this, 'CommonDependenciesLayer', {
            code: lambda.Code.fromAsset('../layers/common'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
            description: 'AWS SDK v3 + utilidades comunes (response, logger, validation)',
            layerVersionName: 'boyhappy-common-dependencies',
        });
        const LAMBDA_PROFILES = {
            light: { memory: 256, timeout: 10 }, // Auth, callbacks
            medium: { memory: 512, timeout: 15 }, // CRUD operations
            heavy: { memory: 1024, timeout: 30 }, // Reportes, S3, backups
        };
        const createLambda = (name, handlerFile, handlerName = 'handler', environment = {}, config = LAMBDA_PROFILES.medium) => {
            return new lambda.Function(this, name, {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: `${handlerFile}.${handlerName}`,
                code: lambda.Code.fromAsset('..', {
                    exclude: [
                        'infra/**',
                        'frontend/**',
                        'scripts/**',
                        'dist/**',
                        '*.md',
                        '.git/**',
                        'node_modules/**',
                    ],
                }),
                layers: [commonLayer],
                environment: {
                    ...environment,
                    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
                    NODE_OPTIONS: '--enable-source-maps',
                    LAST_DEPLOY: new Date().toISOString(),
                },
                timeout: cdk.Duration.seconds(config.timeout || 10),
                memorySize: config.memory || 384,
                logRetention: logs.RetentionDays.ONE_WEEK,
            });
        };
        // ----------------------------
        // API GATEWAY - CREAR PRIMERO PARA OBTENER LA URL
        // ----------------------------
        const api = new apigateway.RestApi(this, 'BoyHappyApi', {
            restApiName: 'BoyHappy Service',
            deployOptions: {
                stageName: 'prod',
            },
            defaultCorsPreflightOptions: {
                // CORS: Orígenes específicos para desarrollo local + producción S3
                // CRITICAL: allowCredentials: true requiere orígenes específicos (NO wildcards)
                allowOrigins: [
                    'http://localhost:3005', // Frontend dev server (Vite default)
                    'http://127.0.0.1:3005',
                    'http://localhost:3000', // Fallback dev port
                    'http://127.0.0.1:3000',
                    frontendBucket.bucketWebsiteUrl // S3 Static Website URL (producción)
                ],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'Cookie',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                    'X-Requested-With'
                ],
                allowCredentials: true,
                maxAge: cdk.Duration.minutes(10)
            },
        });
        // Construir la URL del API Gateway manualmente sin crear dependencia circular
        const apiUrl = `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod`;
        // ----------------------------
        // MAPA DE TABLAS PARA AUTO-GRANT
        // Usa las CLAVES del .env como keys (única fuente de verdad)
        // ----------------------------
        const tablesMap = new Map([
            ['USUARIOS_TABLE', usuariosTable],
            ['COMUNICACIONES_TABLE', comunicacionesTable],
            ['RECURSOS_TABLE', recursosAcademicosTable],
            ['ASISTENCIA_TABLE', asistenciaTable],
            ['AGENDA_TABLE', agendaFonoTable],
            ['CONFIGURACION_TABLE', configuracionTable],
            ['INFORMES_TABLE', informesTable],
            ['REPORTES_TABLE', reportesTable],
            ['APODERADOS_TABLE', apoderadosTable],
            ['APODERADO_ALUMNO_TABLE', apoderadoAlumnoTable],
            ['PROFESOR_CURSO_TABLE', profesorCursoTable],
            ['RETROALIMENTACION_TABLE', retroalimentacionTable],
            ['MATERIAL_CATEGORIAS_TABLE', materialCategoriasTable]
        ]);
        const bucketsMap = new Map([
            ['images', imagesBucket],
            ['materiales', materialesBucket],
            ['backups', backupsBucket],
            ['frontend', frontendBucket]
        ]);
        // ----------------------------
        // FUNCIÓN: AUTO-GRANT PERMISSIONS
        // ----------------------------
        /**
         * Otorga permisos automáticamente basándose en la metadata de la lambda
         */
        const autoGrantPermissions = (lambdaFunction, metadata) => {
            // 1. Permisos de DynamoDB Tables
            if (metadata.tables && metadata.tables.length > 0) {
                for (const tableSpec of metadata.tables) {
                    // Formato: "TableName" o "TableName:read" o "TableName:write"
                    const [tableName, accessType = 'readwrite'] = tableSpec.split(':');
                    const table = tablesMap.get(tableName);
                    if (table) {
                        if (accessType === 'read') {
                            table.grantReadData(lambdaFunction);
                            console.log(`    📖 Granted READ on ${tableName}`);
                        }
                        else if (accessType === 'write') {
                            table.grantWriteData(lambdaFunction);
                            console.log(`    ✍️  Granted WRITE on ${tableName}`);
                        }
                        else {
                            table.grantReadWriteData(lambdaFunction);
                            console.log(`    📝 Granted READ/WRITE on ${tableName}`);
                        }
                    }
                    else {
                        console.warn(`    ⚠️  Table not found: ${tableName}`);
                    }
                }
            }
            // 2. Permisos de S3 Buckets
            if (metadata.buckets && metadata.buckets.length > 0) {
                for (const bucketSpec of metadata.buckets) {
                    // Formato: "bucketName" o "bucketName:readwrite" o "bucketName:readonly"
                    const [bucketName, permission = 'readwrite'] = bucketSpec.split(':');
                    const bucket = bucketsMap.get(bucketName.toLowerCase());
                    if (bucket) {
                        if (permission === 'readwrite') {
                            bucket.grantReadWrite(lambdaFunction);
                            console.log(`    📦 Granted readwrite access to bucket: ${bucketName}`);
                        }
                        else if (permission === 'readonly') {
                            bucket.grantRead(lambdaFunction);
                            console.log(`    📦 Granted readonly access to bucket: ${bucketName}`);
                        }
                    }
                    else {
                        console.warn(`    ⚠️  Bucket not found: ${bucketName}`);
                    }
                }
            }
            // 3. Políticas adicionales (SES, Cognito, S3, etc)
            if (metadata.additionalPolicies && metadata.additionalPolicies.length > 0) {
                for (const policy of metadata.additionalPolicies) {
                    // Skip policies without resources
                    if (!policy.resources || policy.resources.length === 0) {
                        console.warn(`    ⚠️  Skipping policy without resources: ${policy.actions?.join(', ') || 'unknown'}`);
                        continue;
                    }
                    const resources = policy.resources.map(r => {
                        // Expandir recursos especiales
                        if (r === 'userpool') {
                            return `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`;
                        }
                        return r;
                    });
                    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
                        actions: policy.actions,
                        resources: resources
                    }));
                    console.log(`    🔐 Granted custom policy: ${policy.actions.join(', ')}`);
                }
            }
        };
        // ----------------------------
        // LAMBDAS OPTIMIZADAS - Usar apiUrl construida dinámicamente
        // ----------------------------
        // Frontend Server Lambda - SOLO PARA DESARROLLO LOCAL (dev-server.js)
        // En producción, el frontend se sirve desde CloudFront + S3
        // Esta lambda se mantiene deployada pero NO se usa en producción
        // ⚠️ ELIMINADO: Frontend ahora es SPA servida desde S3
        // @ts-ignore - Temporary compatibility
        const frontendServerLambda = null;
        // ==========================================
        // TODAS LAS LAMBDAS AHORA USAN AUTO-DISCOVERY
        // Las lambdas se descubren automáticamente desde la carpeta api/
        // y se configuran usando el metadata exportado en cada archivo
        // ==========================================
        // ==========================================
        // 🆕 AUTO-DISCOVERY DE LAMBDAS
        // ==========================================
        console.log('\n🚀 Starting Lambda Auto-Discovery...');
        // Descubrir todas las lambdas en /api
        const discoveredLambdas = discoverLambdas('../../api');
        // Crear un mapa de lambdas creadas automáticamente
        const autoLambdas = new Map();
        const autoRouteMap = {};
        // Procesar TODAS las lambdas discovered que tengan metadata válida
        const lambdasToCreate = discoveredLambdas.filter(l => {
            // Excluir lambdas que claramente no son API endpoints
            const excluded = ['handler', 'index', '_template', 'requireLayer'];
            return !excluded.includes(l.name) && l.metadata.route;
        });
        console.log(`\n📋 Creating ${lambdasToCreate.length} auto-discovered lambdas...\n`);
        for (const discovered of lambdasToCreate) {
            const { name, metadata } = discovered;
            console.log(`🔨 Creating lambda: ${name}`);
            // Determinar profile
            const profile = LAMBDA_PROFILES[metadata.profile || 'medium'];
            // Construir environment variables automáticamente
            const environment = {};
            // Agregar API_URL si es necesario
            environment['API_URL'] = apiUrl;
            // Agregar USER_POOL_ID si tiene políticas de Cognito
            if (metadata.additionalPolicies?.some(p => p.resources?.includes('userpool'))) {
                environment['USER_POOL_ID'] = process.env.USER_POOL_ID || '';
            }
            // Agregar SOURCE_EMAIL y CONTACT_EMAIL si tiene políticas de SES
            if (metadata.additionalPolicies?.some(p => p.actions?.includes('ses:SendEmail'))) {
                environment['SOURCE_EMAIL'] = process.env.SOURCE_EMAIL || 'noreply@boyhappy.cl';
                environment['CONTACT_EMAIL'] = process.env.CONTACT_EMAIL || 'admin@boyhappy.cl';
            }
            // Agregar variables de tabla automáticamente
            if (metadata.tables) {
                for (const tableSpec of metadata.tables) {
                    const [envKey] = tableSpec.split(':'); // Ej: 'AGENDA_TABLE'
                    const table = tablesMap.get(envKey);
                    if (table) {
                        // Directamente: AGENDA_TABLE = 'AgendaFonoaudiologia'
                        environment[envKey] = table.tableName;
                    }
                    else {
                        console.warn(`⚠️  Table not found in tablesMap: ${envKey}`);
                        console.warn(`    Available keys: ${Array.from(tablesMap.keys()).join(', ')}`);
                    }
                }
            }
            // Agregar variables de bucket automáticamente
            if (metadata.buckets) {
                for (const bucketSpec of metadata.buckets) {
                    const [bucketName] = bucketSpec.split(':');
                    const bucket = bucketsMap.get(bucketName.toLowerCase());
                    if (bucket) {
                        // Convención: IMAGES_BUCKET, MATERIALES_BUCKET, etc.
                        const envVarName = `${bucketName.toUpperCase()}_BUCKET`;
                        environment[envVarName] = bucket.bucketName;
                    }
                }
            }
            // Crear la lambda
            const lambdaFunction = createLambda(`${name.charAt(0).toUpperCase() + name.slice(1)}Lambda`, `api/${name}`, 'handler', environment, profile);
            // Auto-grant permisos
            autoGrantPermissions(lambdaFunction, metadata);
            // Guardar en mapa
            autoLambdas.set(name, lambdaFunction);
            autoRouteMap[metadata.route] = lambdaFunction;
            console.log(`  ✅ ${name} created successfully\n`);
        }
        console.log(`\n✅ Auto-discovery complete! ${lambdasToCreate.length} lambdas created automatically\n`);
        console.log('📍 Auto-discovered routes:', Object.keys(autoRouteMap).join(', '));
        console.log('\n' + '='.repeat(80) + '\n');
        // EventBridge Rule para backups diarios a las 2 AM Chile
        const backupLambda = autoLambdas.get('backup');
        if (backupLambda) {
            const backupRule = new events.Rule(this, 'BackupDiarioRule', {
                ruleName: 'boyhappy-backup-diario',
                description: 'Ejecuta backup automático diario a las 2 AM',
                schedule: events.Schedule.cron({
                    minute: '0',
                    hour: '6', // 6 AM UTC = 2 AM Chile (UTC-4)
                    day: '*',
                    month: '*',
                    year: '*'
                }),
                enabled: true
            });
            backupRule.addTarget(new targets.LambdaFunction(backupLambda));
            console.log('✅ Backup diario configurado correctamente\n');
        }
        const usuariosLambda = autoLambdas.get('UsuariosLambda');
        if (usuariosLambda) {
            const userPoolId = process.env.COGNITO_USER_POOL_ID;
            console.log('User Pool ID:', userPoolId);
            usuariosLambda.addToRolePolicy(new iam.PolicyStatement({
                actions: [
                    'cognito-idp:AdminCreateUser',
                    'cognito-idp:AdminAddUserToGroup',
                    'cognito-idp:AdminRemoveUserFromGroup'
                ],
                resources: [`arn:aws:cognito-idp:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:userpool/${process.env.USER_POOL_ID}`]
            }));
            console.log('✅ Cognito policy added to Usuarios Lambda');
        }
        // ----------------------------
        // CONFIGURACIÓN DE ROUTING EN API GATEWAY
        // ----------------------------
        // Usar SOLO lambdas auto-descubiertas
        const routeMap = autoRouteMap;
        // Lambda Router centralizado
        const apiRouterLambda = new lambda.Function(this, 'ApiRouterLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const lambdaClient = new LambdaClient({});

const ROUTE_MAP = ${JSON.stringify(Object.fromEntries(Object.entries(routeMap).map(([route, fn]) => [route, fn.functionName])))};

// Router Lambda - Updated: 2025-11-24T22:00:00Z - Fix /api/ prefix handling
exports.handler = async (event) => {

  let path = event.path || '/';
  const originalPath = path;

  // Eliminar prefijo /api/ si existe (frontend puede enviar /api/categorias)
  if (path.startsWith('/api/')) {
    path = path.replace('/api/', '/');
    console.log('Cleaned /api/ prefix:', originalPath, '->', path);
  }

  const basePath = '/' + (path.split('/')[1] || '');

  // Buscar lambda por ruta base
  let targetLambda = ROUTE_MAP[basePath] || ROUTE_MAP[path];

  // Rutas especiales con sub-paths
  if (path.startsWith('/notas/agrupadas')) targetLambda = ROUTE_MAP['/notas'];
  if (path.startsWith('/notas/promedios')) targetLambda = ROUTE_MAP['/notas'];
  if (path.startsWith('/materiales/aprobar')) targetLambda = ROUTE_MAP['/materiales'];
  if (path.startsWith('/materiales/rechazar')) targetLambda = ROUTE_MAP['/materiales'];
  if (path.startsWith('/materiales/corregir')) targetLambda = ROUTE_MAP['/materiales'];
  if (path.startsWith('/sesiones/archivos')) targetLambda = ROUTE_MAP['/sesiones'];
  if (path.startsWith('/reportes/')) targetLambda = ROUTE_MAP['/reportes'];
  if (path.startsWith('/exportar/')) targetLambda = ROUTE_MAP['/exportar'];

  // ⚠️ ELIMINADO: Static files and home routing
  // Frontend is now served from S3 Static Website

  if (!targetLambda) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Route not found', path })
    };
  }

  try {
    console.log('Invoking lambda:', targetLambda, 'with path:', path);

    // IMPORTANTE: Modificar el event para que el path no tenga /api/
    // Los lambdas esperan rutas sin el prefijo /api/
    const modifiedEvent = {
      ...event,
      path: path,  // Usar el path limpio (sin /api/)
      resource: path
    };

    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: targetLambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(modifiedEvent)
    }));

    if (response.FunctionError) {
      console.error('Lambda invocation error:', response.FunctionError);
      console.error('Payload:', new TextDecoder().decode(response.Payload));

      return {
        statusCode: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Lambda execution error',
          details: response.FunctionError,
          payload: new TextDecoder().decode(response.Payload)
        })
      };
    }

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    console.log('Lambda response status:', result.statusCode);

    return result;
  } catch (error) {
    console.error('Router error:', error);
    console.error('Error stack:', error.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Internal routing error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
      `),
            timeout: cdk.Duration.seconds(15),
            memorySize: 256,
            environment: {
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
            },
        });
        // Dar permisos al router para invocar todas las lambdas
        Object.values(routeMap).forEach(fn => {
            fn.grantInvoke(apiRouterLambda);
        });
        // ============================================
        // API GATEWAY ROUTING
        // ============================================
        // NOTA: Frontend se sirve desde S3 Static Website Hosting (FREE TIER)
        //       frontendServerLambda solo se usa en dev-server.js local
        //       Backend APIs se acceden directamente via API Gateway
        // Proxy para APIs - todas las rutas van al router
        const proxy = api.root.addResource('{proxy+}');
        proxy.addMethod('ANY', new apigateway.LambdaIntegration(apiRouterLambda));
        // ----------------------------
        // FREE TIER: NO CLOUDFRONT
        // ----------------------------
        // CloudFront se ha eliminado para mantenerse en el Free Tier
        // El frontend se sirve desde S3 Static Website Hosting
        // LIMITACIÓN: Solo HTTP (no HTTPS) a menos que uses CloudFront (costo extra)
        //
        // Para habilitar HTTPS en el futuro (con costo):
        // 1. Descomentar el código de CloudFront más abajo
        // 2. Actualizar frontendBucket para usar OAI en lugar de publicReadAccess
        // ----------------------------
        // Outputs
        // ----------------------------
        new cdk.CfnOutput(this, 'ImagesBucketName', {
            value: imagesBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'MaterialesBucketName', {
            value: materialesBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'BackupsBucketName', {
            value: backupsBucket.bucketName,
            description: 'Bucket de backups automáticos (retención 30 días)',
        });
        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: frontendBucket.bucketName,
            description: 'Bucket S3 para archivos estáticos del frontend',
            exportName: 'BoyHappyFrontendBucket'
        });
        new cdk.CfnOutput(this, 'FrontendWebsiteURL', {
            value: frontendBucket.bucketWebsiteUrl,
            description: '🌐 URL del Frontend (S3 Static Website - FREE TIER) - USAR ESTA URL',
            exportName: 'BoyHappyFrontendURL'
        });
        new cdk.CfnOutput(this, 'ApiGatewayURL', {
            value: api.url,
            description: '🔗 URL de API Gateway (Backend APIs)',
            exportName: 'BoyHappyApiURL'
        });
        // NOTA: Los nombres de tablas NO se exportan como outputs porque:
        // - Las lambdas reciben los nombres automáticamente vía auto-inyección CDK
        // - No hay scripts externos que necesiten acceder a estos valores
        // - Mantiene outputs.json simple y solo con información útil para el usuario
    }
}
exports.BoyHappyStack = BoyHappyStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELDJEQUE2QztBQUU3Qyx1REFBeUM7QUFDekMseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFJMUQsK0NBQWlDO0FBQ2pDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBRWxDLG9FQUFvRTtBQUNwRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQTRCNUQsNkNBQTZDO0FBQzdDLHFDQUFxQztBQUNyQyw2Q0FBNkM7QUFFN0M7OztHQUdHO0FBQ0gsU0FBUyxlQUFlLENBQUMsU0FBaUI7SUFDeEMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFFeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUU1RCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUNBQW1DLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDaEUsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0lBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUM7U0FDdkMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMs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QUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxjQUFjLENBQUMsVUFBVTtZQUNoQyxXQUFXLEVBQUUsZ0RBQWdEO1lBQzdELFVBQVUsRUFBRSx3QkFBd0I7U0FDckMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtZQUN0QyxXQUFXLEVBQUUscUVBQXFFO1lBQ2xGLFVBQVUsRUFBRSxxQkFBcUI7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHNDQUFzQztZQUNuRCxVQUFVLEVBQUUsZ0JBQWdCO1NBQzdCLENBQUMsQ0FBQztRQUVILGtFQUFrRTtRQUNsRSwyRUFBMkU7UUFDM0Usa0VBQWtFO1FBQ2xFLDZFQUE2RTtJQUMvRSxDQUFDO0NBQ0Y7QUExM0JELHNDQTAzQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xyXG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XHJcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xyXG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xyXG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XHJcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5kb3RlbnYuY29uZmlnKHsgcGF0aDogJy4vLmVudicgfSk7XHJcblxyXG4vLyBJbXBvcnRhciBjb25zdGFudGVzIGRlIG5vbWJyZXMgZGUgdGFibGFzICjDum5pY2EgZnVlbnRlIGRlIHZlcmRhZClcclxuY29uc3QgVEFCTEVfTkFNRVMgPSByZXF1aXJlKCcuLi8uLi9zaGFyZWQvdGFibGUtbmFtZXMuY2pzJyk7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gVElQT1MgUEFSQSBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuaW50ZXJmYWNlIExhbWJkYU1ldGFkYXRhIHtcclxuICByb3V0ZTogc3RyaW5nO1xyXG4gIG1ldGhvZHM/OiBzdHJpbmdbXTtcclxuICBhdXRoPzogYm9vbGVhbjtcclxuICBhdXRoRXhjZXB0aW9ucz86IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xyXG4gIHJvbGVzPzogc3RyaW5nW107XHJcbiAgcHJvZmlsZT86ICdsaWdodCcgfCAnbWVkaXVtJyB8ICdoZWF2eSc7XHJcbiAgdGFibGVzPzogc3RyaW5nW107XHJcbiAgYnVja2V0cz86IHN0cmluZ1tdO1xyXG4gIGFkZGl0aW9uYWxQb2xpY2llcz86IEFycmF5PHtcclxuICAgIGFjdGlvbnM6IHN0cmluZ1tdO1xyXG4gICAgcmVzb3VyY2VzOiBzdHJpbmdbXTtcclxuICB9PjtcclxufVxyXG5cclxuaW50ZXJmYWNlIERpc2NvdmVyZWRMYW1iZGEge1xyXG4gIG5hbWU6IHN0cmluZzsgICAgICAgICAgICAgIC8vIE5vbWJyZSBkZWwgYXJjaGl2byBzaW4gLmpzXHJcbiAgZmlsZU5hbWU6IHN0cmluZzsgICAgICAgICAgLy8gTm9tYnJlIGNvbXBsZXRvIGRlbCBhcmNoaXZvXHJcbiAgZmlsZVBhdGg6IHN0cmluZzsgICAgICAgICAgLy8gUnV0YSBhYnNvbHV0YSBhbCBhcmNoaXZvXHJcbiAgbWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhOyAgLy8gTWV0YWRhdGEgZXhwb3J0YWRhXHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBGVU5DScOTTjogQVVUTy1ESVNDT1ZFUlkgREUgTEFNQkRBU1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBEZXNjdWJyZSBhdXRvbcOhdGljYW1lbnRlIHRvZGFzIGxhcyBsYW1iZGFzIGVuIGVsIGRpcmVjdG9yaW8gZXNwZWNpZmljYWRvXHJcbiAqIHkgZXh0cmFlIHN1IG1ldGFkYXRhIHBhcmEgYXV0by1jb25maWd1cmFjacOzblxyXG4gKi9cclxuZnVuY3Rpb24gZGlzY292ZXJMYW1iZGFzKGxhbWJkYURpcjogc3RyaW5nKTogRGlzY292ZXJlZExhbWJkYVtdIHtcclxuICBjb25zdCBhYnNvbHV0ZVBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBsYW1iZGFEaXIpO1xyXG5cclxuICBjb25zb2xlLmxvZyhgXFxu8J+UjSBEaXNjb3ZlcmluZyBsYW1iZGFzIGluOiAke2Fic29sdXRlUGF0aH1gKTtcclxuXHJcbiAgaWYgKCFmcy5leGlzdHNTeW5jKGFic29sdXRlUGF0aCkpIHtcclxuICAgIGNvbnNvbGUud2Fybihg4pqg77iPICBMYW1iZGEgZGlyZWN0b3J5IG5vdCBmb3VuZDogJHthYnNvbHV0ZVBhdGh9YCk7XHJcbiAgICByZXR1cm4gW107XHJcbiAgfVxyXG5cclxuICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGFic29sdXRlUGF0aClcclxuICAgIC5maWx0ZXIoZiA9PiBmLmVuZHNXaXRoKCcuanMnKSAmJiAhZi5zdGFydHNXaXRoKCdfJykgJiYgIWYuc3RhcnRzV2l0aCgnLicpKTtcclxuXHJcbiAgY29uc29sZS5sb2coYPCfk6YgRm91bmQgJHtmaWxlcy5sZW5ndGh9IGxhbWJkYSBmaWxlc2ApO1xyXG5cclxuICBjb25zdCBkaXNjb3ZlcmVkOiBEaXNjb3ZlcmVkTGFtYmRhW10gPSBbXTtcclxuXHJcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XHJcbiAgICBjb25zdCBuYW1lID0gZmlsZS5yZXBsYWNlKCcuanMnLCAnJyk7XHJcbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihhYnNvbHV0ZVBhdGgsIGZpbGUpO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIEludGVudGFyIGNhcmdhciBlbCBtw7NkdWxvIHBhcmEgbGVlciBtZXRhZGF0YVxyXG4gICAgICAvLyBOT1RBOiBFbiB0aWVtcG8gZGUgQ0RLIHN5bnRoLCBlc3RvIHJlcXVpZXJlIHF1ZSBsb3MgbcOzZHVsb3Mgc2VhbiB2w6FsaWRvc1xyXG4gICAgICAvLyBTaSBoYXkgZXJyb3JlcyBkZSByZXF1aXJlIChmYWx0YW4gZGVwcyksIHVzYW1vcyBtZXRhZGF0YSBwb3IgZGVmZWN0b1xyXG4gICAgICBkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUoZmlsZVBhdGgpXTtcclxuICAgICAgY29uc3QgbW9kdWxlID0gcmVxdWlyZShmaWxlUGF0aCk7XHJcblxyXG4gICAgICBjb25zdCBtZXRhZGF0YTogTGFtYmRhTWV0YWRhdGEgPSBtb2R1bGUubWV0YWRhdGEgfHwge1xyXG4gICAgICAgIHJvdXRlOiBgLyR7bmFtZX1gLFxyXG4gICAgICAgIG1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnXSxcclxuICAgICAgICBhdXRoOiB0cnVlLFxyXG4gICAgICAgIHJvbGVzOiBbJyonXSxcclxuICAgICAgICBwcm9maWxlOiAnbWVkaXVtJyxcclxuICAgICAgICB0YWJsZXM6IFtdXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBkaXNjb3ZlcmVkLnB1c2goe1xyXG4gICAgICAgIG5hbWUsXHJcbiAgICAgICAgZmlsZU5hbWU6IGZpbGUsXHJcbiAgICAgICAgZmlsZVBhdGgsXHJcbiAgICAgICAgbWV0YWRhdGFcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhgICDinIUgJHtuYW1lfTogJHttZXRhZGF0YS5yb3V0ZX0gWyR7bWV0YWRhdGEucHJvZmlsZX1dICR7bWV0YWRhdGEuYXV0aCA/ICfwn5SSJyA6ICfwn4yQJ31gKTtcclxuXHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihgICDimqDvuI8gIENvdWxkIG5vdCBsb2FkIG1ldGFkYXRhIGZvciAke2ZpbGV9OmAsIGVycm9yLm1lc3NhZ2UpO1xyXG5cclxuICAgICAgLy8gVXNhciBtZXRhZGF0YSBwb3IgZGVmZWN0byBzaSBubyBzZSBwdWVkZSBjYXJnYXJcclxuICAgICAgY29uc3QgZGVmYXVsdE1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YSA9IHtcclxuICAgICAgICByb3V0ZTogYC8ke25hbWV9YCxcclxuICAgICAgICBtZXRob2RzOiBbJ0dFVCcsICdQT1NUJ10sXHJcbiAgICAgICAgYXV0aDogdHJ1ZSxcclxuICAgICAgICByb2xlczogWycqJ10sXHJcbiAgICAgICAgcHJvZmlsZTogJ21lZGl1bScsXHJcbiAgICAgICAgdGFibGVzOiBbXVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgZGlzY292ZXJlZC5wdXNoKHtcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIGZpbGVOYW1lOiBmaWxlLFxyXG4gICAgICAgIGZpbGVQYXRoLFxyXG4gICAgICAgIG1ldGFkYXRhOiBkZWZhdWx0TWV0YWRhdGFcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhgICDimqDvuI8gICR7bmFtZX06IFVzaW5nIGRlZmF1bHQgbWV0YWRhdGFgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnNvbGUubG9nKGBcXG7inIUgRGlzY292ZXJ5IGNvbXBsZXRlOiAke2Rpc2NvdmVyZWQubGVuZ3RofSBsYW1iZGFzIGNvbmZpZ3VyZWRcXG5gKTtcclxuXHJcbiAgcmV0dXJuIGRpc2NvdmVyZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBCb3lIYXBweVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwcml2YXRlIHVzdWFyaW9zTGFtYmRhPzogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBCdWNrZXRzIFMzXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBpbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdJbWFnZXNCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBib3loYXBweS1pbWFnZXMtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIGNvcnM6IFt7XHJcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxyXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcclxuICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ11cclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG1hdGVyaWFsZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdNYXRlcmlhbGVzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktbWF0ZXJpYWxlcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgY29yczogW3tcclxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVF0sXHJcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBiYWNrdXBzIGF1dG9tw6F0aWNvc1xyXG4gICAgLy8gRlJFRSBUSUVSOiBTaW4gdmVyc2lvbmFkbyBwYXJhIGV2aXRhciBjb3N0b3MgYWRpY2lvbmFsZXNcclxuICAgIGNvbnN0IGJhY2t1cHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWNrdXBzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktYmFja3Vwcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sIC8vIFJFVEFJTiBwYXJhIG5vIHBlcmRlciBiYWNrdXBzXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIEZSRUUgVElFUjogRGVzYWN0aXZhZG8gcGFyYSBldml0YXIgY29zdG9zXHJcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbe1xyXG4gICAgICAgIC8vIFJldGVuZXIgc29sbyA3IGTDrWFzIGRlIGJhY2t1cHMgcGFyYSBtYW50ZW5lcnNlIGVuIEZyZWUgVGllclxyXG4gICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBmcm9udGVuZCBlc3TDoXRpY28gKEhUTUwvQ1NTL0pTKVxyXG4gICAgLy8gRlJFRSBUSUVSOiBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nIChzaW4gQ2xvdWRGcm9udCBwYXJhIGV2aXRhciBjb3N0b3MpXHJcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktZnJvbnRlbmQtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIC8vIENvbmZpZ3VyYWNpw7NuIHBhcmEgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAocMO6YmxpY28pXHJcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXHJcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSBmYWxsYmFja1xyXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLCAvLyBQZXJtaXRlIGFjY2VzbyBww7pibGljbyBwYXJhIFN0YXRpYyBXZWJzaXRlXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xyXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcclxuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2VcclxuICAgICAgfSksXHJcbiAgICAgIGNvcnM6IFt7XHJcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcclxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ11cclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFRBQkxBUyBEWU5BTU9EQiBPUFRJTUlaQURBU1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgIC8vIDEuIFRBQkxBIFVTVUFSSU9TXHJcbiAgICAvLyBGUkVFIFRJRVI6IFBST1ZJU0lPTkVEIG1vZGUgY29uIDUgUkNVL1dDVSAoZ3JhdGlzIHBlcm1hbmVudGVtZW50ZSlcclxuICAgIGNvbnN0IHVzdWFyaW9zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzdWFyaW9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuVVNVQVJJT1NfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDUsICAvLyBGUkVFIFRJRVI6IDI1IFJDVSB0b3RhbGVzIGNvbXBhcnRpZGFzIGVudHJlIHRvZGFzIGxhcyB0YWJsYXNcclxuICAgICAgd3JpdGVDYXBhY2l0eTogNSwgLy8gRlJFRSBUSUVSOiAyNSBXQ1UgdG90YWxlcyBjb21wYXJ0aWRhcyBlbnRyZSB0b2RhcyBsYXMgdGFibGFzXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICB1c3Vhcmlvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRW1haWxJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY29ycmVvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDIuIFRBQkxBIENPTVVOSUNBQ0lPTkVTIChmdXNpb25hIEFudW5jaW9zICsgRXZlbnRvcyArIE1hdHJpY3VsYXMpXHJcbiAgICBjb25zdCBjb211bmljYWNpb25lc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb211bmljYWNpb25lc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkNPTVVOSUNBQ0lPTkVTX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBmaWx0cmFyIHBvciB0aXBvIHkgZmVjaGFcclxuICAgIGNvbXVuaWNhY2lvbmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGZpbHRyYXIgbWF0csOtY3VsYXMgcG9yIGVzdGFkb1xyXG4gICAgY29tdW5pY2FjaW9uZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VzdGFkb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlc3RhZG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMy4gVEFCTEEgQVNJU1RFTkNJQVxyXG4gICAgY29uc3QgYXNpc3RlbmNpYVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBc2lzdGVuY2lhVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVNJU1RFTkNJQV9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgYXNpc3RlbmNpYVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29GZWNoYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjdXJzbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGFzaXN0ZW5jaWFUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0LiBUQUJMQSBSRUNVUlNPUyBBQ0FERU1JQ09TIChmdXNpb25hIE5vdGFzICsgTWF0ZXJpYWxlcyArIEJpdMOhY29yYSArIENhdGVnb3LDrWFzKVxyXG4gICAgY29uc3QgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JlY3Vyc29zQWNhZGVtaWNvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlJFQ1VSU09TX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBhbHVtbm8gKG5vdGFzKVxyXG4gICAgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBjdXJzbyB5IGFzaWduYXR1cmFcclxuICAgIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29Bc2lnbmF0dXJhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXNpZ25hdHVyYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBqZXJhcnF1w61hIGRlIGNhdGVnb3LDrWFzIChwYXJlbnQtY2hpbGQpXHJcbiAgICByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1BhcmVudENhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwYXJlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKchSBHU0kgcGFyYSBidXNjYXIgc29sbyBwb3IgSUQgKHNpbiB0aXBvKSAtIFBlcm1pdGUgR2V0Q29tbWFuZCBjb24gc29sbyB7aWR9XHJcbiAgICAvLyBOT1RBOiBBdW5xdWUgc2UgcHVlZGUgdXNhciBHZXRDb21tYW5kIGNvbiB7aWQsIHRpcG99LCBlc3RlIEdTSSBwZXJtaXRlIHF1ZXJpZXMgbcOhcyBmbGV4aWJsZXNcclxuICAgIC8vIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgIC8vICAgaW5kZXhOYW1lOiAnSWRJbmRleCcsXHJcbiAgICAvLyAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgLy8gICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgLy8gfSk7XHJcbiAgICAvLyBDT01FTlRBRE86IEVuIHJlYWxpZGFkIG5vIGVzIG5lY2VzYXJpbyB1biBHU0kgcGFyYSBHZXRDb21tYW5kLlxyXG4gICAgLy8gR2V0Q29tbWFuZCBmdW5jaW9uYSBjb24gcGFydGl0aW9uIGtleSArIHNvcnQga2V5OiB7aWQsIHRpcG99XHJcbiAgICAvLyBFbCBiYWNrZW5kIGZ1ZSBhY3R1YWxpemFkbyBwYXJhIGZ1bmNpb25hciBhc8OtLlxyXG5cclxuICAgIC8vIDUuIFRBQkxBIFJFVFJPQUxJTUVOVEFDSU9OICh1bmlmaWNhIHRvZGFzIGxhcyBvYnNlcnZhY2lvbmVzKVxyXG4gICAgY29uc3QgcmV0cm9hbGltZW50YWNpb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmV0cm9hbGltZW50YWNpb25UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5SRVRST0FMSU1FTlRBQ0lPTl9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRVc3VhcmlvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBjb25zdWx0YXMgcG9yIG9yaWdlbiB5IGZlY2hhXHJcbiAgICByZXRyb2FsaW1lbnRhY2lvblRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnT3JpZ2VuRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnb3JpZ2VuJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNi4gVEFCTEEgQUdFTkRBIEZPTk9BVURJT0xPR0lBIChyZW5vbWJyYWRhKVxyXG4gICAgY29uc3QgYWdlbmRhRm9ub1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBZ2VuZGFGb25vVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQUdFTkRBX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZlY2hhSG9yYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNy4gVEFCTEEgQ09ORklHVVJBQ0lPTlxyXG4gICAgY29uc3QgY29uZmlndXJhY2lvblRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb25maWd1cmFjaW9uVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQ09ORklHVVJBQ0lPTl9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAxLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAxLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNy41LiBUQUJMQSBNQVRFUklBTENBVEVHT1JJQVMgKFJlbGFjacOzbiBNYW55LXRvLU1hbnkpXHJcbiAgICBjb25zdCBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTWF0ZXJpYWxDYXRlZ29yaWFzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuTUFURVJJQUxfQ0FURUdPUklBU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdtYXRlcmlhbElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY2F0ZWdvcmlhSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBBdXRvLXNjYWxpbmcgcGFyYSBtZWpvciBlc2NhbGFiaWxpZGFkXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgaW52ZXJzbyBwYXJhIGNvbnN1bHRhciBtYXRlcmlhbGVzIHBvciBjYXRlZ29yw61hXHJcbiAgICBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0NhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjYXRlZ29yaWFJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ21hdGVyaWFsSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gOC4gVEFCTEEgSU5GT1JNRVMgKE5VRVZBIC0gRkFTRSA1KVxyXG4gICAgY29uc3QgaW5mb3JtZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW5mb3JtZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5JTkZPUk1FU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaW5mb3JtZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICBpbmZvcm1lc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDkuIFRBQkxBIFJFUE9SVEVTIChOVUVWQSAtIEZBU0UgOSlcclxuICAgIGNvbnN0IHJlcG9ydGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JlcG9ydGVzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuUkVQT1JURVNfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlcG9ydGVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTAuIFRBQkxBIEFQT0RFUkFET1MgKE5VRVZBIC0gUmVsYWNpb25lcyBBcG9kZXJhZG8tQWx1bW5vKVxyXG4gICAgY29uc3QgYXBvZGVyYWRvc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBcG9kZXJhZG9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVBPREVSQURPU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGLDunNxdWVkYSBwb3IgY29ycmVvXHJcbiAgICBhcG9kZXJhZG9zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFbWFpbEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjb3JyZW8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTEuIFRBQkxBIEFQT0RFUkFETy1BTFVNTk8gKFJlbGFjacOzbiBOOk4pXHJcbiAgICBjb25zdCBhcG9kZXJhZG9BbHVtbm9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXBvZGVyYWRvQWx1bW5vVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVBPREVSQURPX0FMVU1OT19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIHF1ZXJpZXMgaW52ZXJzYXMgKGJ1c2NhciBhcG9kZXJhZG9zIHBvciBhbHVtbm8pXHJcbiAgICBhcG9kZXJhZG9BbHVtbm9UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTIuIFRBQkxBIFBST0ZFU09SLUNVUlNPIChSZWxhY2nDs24gMTpOIGNvbiB0aXBvcylcclxuICAgIGNvbnN0IHByb2Zlc29yQ3Vyc29UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvZmVzb3JDdXJzb1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlBST0ZFU09SX0NVUlNPX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Byb2Zlc29yUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3Vyc29UaXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gXCIxQSNqZWZlXCIgbyBcIjFBI2FzaWduYXR1cmEjTWF0ZW3DoXRpY2FzXCJcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBsaXN0YXIgcHJvZmVzb3JlcyBkZSB1biBjdXJzb1xyXG4gICAgcHJvZmVzb3JDdXJzb1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY3Vyc28nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIExhbWJkYSBMYXllciBjb24gZGVwZW5kZW5jaWFzIGNvbXVuZXNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0NvbW1vbkRlcGVuZGVuY2llc0xheWVyJywge1xyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2xheWVycy9jb21tb24nKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1hdLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FXUyBTREsgdjMgKyB1dGlsaWRhZGVzIGNvbXVuZXMgKHJlc3BvbnNlLCBsb2dnZXIsIHZhbGlkYXRpb24pJyxcclxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogJ2JveWhhcHB5LWNvbW1vbi1kZXBlbmRlbmNpZXMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gSGVscGVyIHBhcmEgY3JlYXIgTGFtYmRhcyBjb24gY29uZmlndXJhY2nDs24gb3B0aW1pemFkYVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgaW50ZXJmYWNlIExhbWJkYUNvbmZpZyB7XHJcbiAgICAgIG1lbW9yeT86IG51bWJlcjtcclxuICAgICAgdGltZW91dD86IG51bWJlcjtcclxuICAgICAgY29uY3VycmVuY3k/OiBudW1iZXI7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgTEFNQkRBX1BST0ZJTEVTID0ge1xyXG4gICAgICBsaWdodDogeyBtZW1vcnk6IDI1NiwgdGltZW91dDogMTAgfSwgICAgLy8gQXV0aCwgY2FsbGJhY2tzXHJcbiAgICAgIG1lZGl1bTogeyBtZW1vcnk6IDUxMiwgdGltZW91dDogMTUgfSwgICAvLyBDUlVEIG9wZXJhdGlvbnNcclxuICAgICAgaGVhdnk6IHsgbWVtb3J5OiAxMDI0LCB0aW1lb3V0OiAzMCB9LCAgIC8vIFJlcG9ydGVzLCBTMywgYmFja3Vwc1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjcmVhdGVMYW1iZGEgPSAoXHJcbiAgICAgIG5hbWU6IHN0cmluZyxcclxuICAgICAgaGFuZGxlckZpbGU6IHN0cmluZyxcclxuICAgICAgaGFuZGxlck5hbWU6IHN0cmluZyA9ICdoYW5kbGVyJyxcclxuICAgICAgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSxcclxuICAgICAgY29uZmlnOiBMYW1iZGFDb25maWcgPSBMQU1CREFfUFJPRklMRVMubWVkaXVtXHJcbiAgICApID0+IHtcclxuICAgICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgbmFtZSwge1xyXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICAgIGhhbmRsZXI6IGAke2hhbmRsZXJGaWxlfS4ke2hhbmRsZXJOYW1lfWAsXHJcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLicsIHtcclxuICAgICAgICAgIGV4Y2x1ZGU6IFtcclxuICAgICAgICAgICAgJ2luZnJhLyoqJyxcclxuICAgICAgICAgICAgJ2Zyb250ZW5kLyoqJyxcclxuICAgICAgICAgICAgJ3NjcmlwdHMvKionLFxyXG4gICAgICAgICAgICAnZGlzdC8qKicsXHJcbiAgICAgICAgICAgICcqLm1kJyxcclxuICAgICAgICAgICAgJy5naXQvKionLFxyXG4gICAgICAgICAgICAnbm9kZV9tb2R1bGVzLyoqJyxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAuLi5lbnZpcm9ubWVudCxcclxuICAgICAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScsXHJcbiAgICAgICAgICBOT0RFX09QVElPTlM6ICctLWVuYWJsZS1zb3VyY2UtbWFwcycsXHJcbiAgICAgICAgICBMQVNUX0RFUExPWTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLnRpbWVvdXQgfHwgMTApLFxyXG4gICAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5tZW1vcnkgfHwgMzg0LFxyXG4gICAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQVBJIEdBVEVXQVkgLSBDUkVBUiBQUklNRVJPIFBBUkEgT0JURU5FUiBMQSBVUkxcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0JveUhhcHB5QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ0JveUhhcHB5IFNlcnZpY2UnLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgIC8vIENPUlM6IE9yw61nZW5lcyBlc3BlY8OtZmljb3MgcGFyYSBkZXNhcnJvbGxvIGxvY2FsICsgcHJvZHVjY2nDs24gUzNcclxuICAgICAgICAvLyBDUklUSUNBTDogYWxsb3dDcmVkZW50aWFsczogdHJ1ZSByZXF1aWVyZSBvcsOtZ2VuZXMgZXNwZWPDrWZpY29zIChOTyB3aWxkY2FyZHMpXHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbXHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDA1JywgICAgIC8vIEZyb250ZW5kIGRldiBzZXJ2ZXIgKFZpdGUgZGVmYXVsdClcclxuICAgICAgICAgICdodHRwOi8vMTI3LjAuMC4xOjMwMDUnLFxyXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsICAgICAvLyBGYWxsYmFjayBkZXYgcG9ydFxyXG4gICAgICAgICAgJ2h0dHA6Ly8xMjcuMC4wLjE6MzAwMCcsXHJcbiAgICAgICAgICBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsICAvLyBTMyBTdGF0aWMgV2Vic2l0ZSBVUkwgKHByb2R1Y2Npw7NuKVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxyXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXHJcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXHJcbiAgICAgICAgICAnQ29va2llJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcclxuICAgICAgICBtYXhBZ2U6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKVxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uc3RydWlyIGxhIFVSTCBkZWwgQVBJIEdhdGV3YXkgbWFudWFsbWVudGUgc2luIGNyZWFyIGRlcGVuZGVuY2lhIGNpcmN1bGFyXHJcbiAgICBjb25zdCBhcGlVcmwgPSBgaHR0cHM6Ly8ke2FwaS5yZXN0QXBpSWR9LmV4ZWN1dGUtYXBpLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vcHJvZGA7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gTUFQQSBERSBUQUJMQVMgUEFSQSBBVVRPLUdSQU5UXHJcbiAgICAvLyBVc2EgbGFzIENMQVZFUyBkZWwgLmVudiBjb21vIGtleXMgKMO6bmljYSBmdWVudGUgZGUgdmVyZGFkKVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgdGFibGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPihbXHJcbiAgICAgIFsnVVNVQVJJT1NfVEFCTEUnLCB1c3Vhcmlvc1RhYmxlXSxcclxuICAgICAgWydDT01VTklDQUNJT05FU19UQUJMRScsIGNvbXVuaWNhY2lvbmVzVGFibGVdLFxyXG4gICAgICBbJ1JFQ1VSU09TX1RBQkxFJywgcmVjdXJzb3NBY2FkZW1pY29zVGFibGVdLFxyXG4gICAgICBbJ0FTSVNURU5DSUFfVEFCTEUnLCBhc2lzdGVuY2lhVGFibGVdLFxyXG4gICAgICBbJ0FHRU5EQV9UQUJMRScsIGFnZW5kYUZvbm9UYWJsZV0sXHJcbiAgICAgIFsnQ09ORklHVVJBQ0lPTl9UQUJMRScsIGNvbmZpZ3VyYWNpb25UYWJsZV0sXHJcbiAgICAgIFsnSU5GT1JNRVNfVEFCTEUnLCBpbmZvcm1lc1RhYmxlXSxcclxuICAgICAgWydSRVBPUlRFU19UQUJMRScsIHJlcG9ydGVzVGFibGVdLFxyXG4gICAgICBbJ0FQT0RFUkFET1NfVEFCTEUnLCBhcG9kZXJhZG9zVGFibGVdLFxyXG4gICAgICBbJ0FQT0RFUkFET19BTFVNTk9fVEFCTEUnLCBhcG9kZXJhZG9BbHVtbm9UYWJsZV0sXHJcbiAgICAgIFsnUFJPRkVTT1JfQ1VSU09fVEFCTEUnLCBwcm9mZXNvckN1cnNvVGFibGVdLFxyXG4gICAgICBbJ1JFVFJPQUxJTUVOVEFDSU9OX1RBQkxFJywgcmV0cm9hbGltZW50YWNpb25UYWJsZV0sXHJcbiAgICAgIFsnTUFURVJJQUxfQ0FURUdPUklBU19UQUJMRScsIG1hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlXVxyXG4gICAgXSk7XHJcblxyXG4gICAgY29uc3QgYnVja2V0c01hcCA9IG5ldyBNYXA8c3RyaW5nLCBzMy5CdWNrZXQ+KFtcclxuICAgICAgWydpbWFnZXMnLCBpbWFnZXNCdWNrZXRdLFxyXG4gICAgICBbJ21hdGVyaWFsZXMnLCBtYXRlcmlhbGVzQnVja2V0XSxcclxuICAgICAgWydiYWNrdXBzJywgYmFja3Vwc0J1Y2tldF0sXHJcbiAgICAgIFsnZnJvbnRlbmQnLCBmcm9udGVuZEJ1Y2tldF1cclxuICAgIF0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEZVTkNJw5NOOiBBVVRPLUdSQU5UIFBFUk1JU1NJT05TXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvKipcclxuICAgICAqIE90b3JnYSBwZXJtaXNvcyBhdXRvbcOhdGljYW1lbnRlIGJhc8OhbmRvc2UgZW4gbGEgbWV0YWRhdGEgZGUgbGEgbGFtYmRhXHJcbiAgICAgKi9cclxuICAgIGNvbnN0IGF1dG9HcmFudFBlcm1pc3Npb25zID0gKFxyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uLFxyXG4gICAgICBtZXRhZGF0YTogTGFtYmRhTWV0YWRhdGFcclxuICAgICkgPT4ge1xyXG4gICAgICAvLyAxLiBQZXJtaXNvcyBkZSBEeW5hbW9EQiBUYWJsZXNcclxuICAgICAgaWYgKG1ldGFkYXRhLnRhYmxlcyAmJiBtZXRhZGF0YS50YWJsZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgdGFibGVTcGVjIG9mIG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgICAgLy8gRm9ybWF0bzogXCJUYWJsZU5hbWVcIiBvIFwiVGFibGVOYW1lOnJlYWRcIiBvIFwiVGFibGVOYW1lOndyaXRlXCJcclxuICAgICAgICAgIGNvbnN0IFt0YWJsZU5hbWUsIGFjY2Vzc1R5cGUgPSAncmVhZHdyaXRlJ10gPSB0YWJsZVNwZWMuc3BsaXQoJzonKTtcclxuICAgICAgICAgIGNvbnN0IHRhYmxlID0gdGFibGVzTWFwLmdldCh0YWJsZU5hbWUpO1xyXG5cclxuICAgICAgICAgIGlmICh0YWJsZSkge1xyXG4gICAgICAgICAgICBpZiAoYWNjZXNzVHlwZSA9PT0gJ3JlYWQnKSB7XHJcbiAgICAgICAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OWIEdyYW50ZWQgUkVBRCBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChhY2Nlc3NUeXBlID09PSAnd3JpdGUnKSB7XHJcbiAgICAgICAgICAgICAgdGFibGUuZ3JhbnRXcml0ZURhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg4pyN77iPICBHcmFudGVkIFdSSVRFIG9uICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OdIEdyYW50ZWQgUkVBRC9XUklURSBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAg4pqg77iPICBUYWJsZSBub3QgZm91bmQ6ICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMi4gUGVybWlzb3MgZGUgUzMgQnVja2V0c1xyXG4gICAgICBpZiAobWV0YWRhdGEuYnVja2V0cyAmJiBtZXRhZGF0YS5idWNrZXRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1Y2tldFNwZWMgb2YgbWV0YWRhdGEuYnVja2V0cykge1xyXG4gICAgICAgICAgLy8gRm9ybWF0bzogXCJidWNrZXROYW1lXCIgbyBcImJ1Y2tldE5hbWU6cmVhZHdyaXRlXCIgbyBcImJ1Y2tldE5hbWU6cmVhZG9ubHlcIlxyXG4gICAgICAgICAgY29uc3QgW2J1Y2tldE5hbWUsIHBlcm1pc3Npb24gPSAncmVhZHdyaXRlJ10gPSBidWNrZXRTcGVjLnNwbGl0KCc6Jyk7XHJcbiAgICAgICAgICBjb25zdCBidWNrZXQgPSBidWNrZXRzTWFwLmdldChidWNrZXROYW1lLnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICAgICAgICAgIGlmIChidWNrZXQpIHtcclxuICAgICAgICAgICAgaWYgKHBlcm1pc3Npb24gPT09ICdyZWFkd3JpdGUnKSB7XHJcbiAgICAgICAgICAgICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk6YgR3JhbnRlZCByZWFkd3JpdGUgYWNjZXNzIHRvIGJ1Y2tldDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBlcm1pc3Npb24gPT09ICdyZWFkb25seScpIHtcclxuICAgICAgICAgICAgICBidWNrZXQuZ3JhbnRSZWFkKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk6YgR3JhbnRlZCByZWFkb25seSBhY2Nlc3MgdG8gYnVja2V0OiAke2J1Y2tldE5hbWV9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIOKaoO+4jyAgQnVja2V0IG5vdCBmb3VuZDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMy4gUG9sw610aWNhcyBhZGljaW9uYWxlcyAoU0VTLCBDb2duaXRvLCBTMywgZXRjKVxyXG4gICAgICBpZiAobWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzICYmIG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBwb2xpY3kgb2YgbWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzKSB7XHJcbiAgICAgICAgICAvLyBTa2lwIHBvbGljaWVzIHdpdGhvdXQgcmVzb3VyY2VzXHJcbiAgICAgICAgICBpZiAoIXBvbGljeS5yZXNvdXJjZXMgfHwgcG9saWN5LnJlc291cmNlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAg4pqg77iPICBTa2lwcGluZyBwb2xpY3kgd2l0aG91dCByZXNvdXJjZXM6ICR7cG9saWN5LmFjdGlvbnM/LmpvaW4oJywgJykgfHwgJ3Vua25vd24nfWApO1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCByZXNvdXJjZXMgPSBwb2xpY3kucmVzb3VyY2VzLm1hcChyID0+IHtcclxuICAgICAgICAgICAgLy8gRXhwYW5kaXIgcmVjdXJzb3MgZXNwZWNpYWxlc1xyXG4gICAgICAgICAgICBpZiAociA9PT0gJ3VzZXJwb29sJykge1xyXG4gICAgICAgICAgICAgIHJldHVybiBgYXJuOmF3czpjb2duaXRvLWlkcDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dXNlcnBvb2wvJHtwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUR9YDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcjtcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgIGFjdGlvbnM6IHBvbGljeS5hY3Rpb25zLFxyXG4gICAgICAgICAgICByZXNvdXJjZXM6IHJlc291cmNlc1xyXG4gICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+UkCBHcmFudGVkIGN1c3RvbSBwb2xpY3k6ICR7cG9saWN5LmFjdGlvbnMuam9pbignLCAnKX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gTEFNQkRBUyBPUFRJTUlaQURBUyAtIFVzYXIgYXBpVXJsIGNvbnN0cnVpZGEgZGluw6FtaWNhbWVudGVcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICAvLyBGcm9udGVuZCBTZXJ2ZXIgTGFtYmRhIC0gU09MTyBQQVJBIERFU0FSUk9MTE8gTE9DQUwgKGRldi1zZXJ2ZXIuanMpXHJcbiAgICAvLyBFbiBwcm9kdWNjacOzbiwgZWwgZnJvbnRlbmQgc2Ugc2lydmUgZGVzZGUgQ2xvdWRGcm9udCArIFMzXHJcbiAgICAvLyBFc3RhIGxhbWJkYSBzZSBtYW50aWVuZSBkZXBsb3lhZGEgcGVybyBOTyBzZSB1c2EgZW4gcHJvZHVjY2nDs25cclxuICAgIC8vIOKaoO+4jyBFTElNSU5BRE86IEZyb250ZW5kIGFob3JhIGVzIFNQQSBzZXJ2aWRhIGRlc2RlIFMzXHJcbiAgICAvLyBAdHMtaWdub3JlIC0gVGVtcG9yYXJ5IGNvbXBhdGliaWxpdHlcclxuICAgIGNvbnN0IGZyb250ZW5kU2VydmVyTGFtYmRhID0gbnVsbCBhcyBhbnk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBUT0RBUyBMQVMgTEFNQkRBUyBBSE9SQSBVU0FOIEFVVE8tRElTQ09WRVJZXHJcbiAgICAvLyBMYXMgbGFtYmRhcyBzZSBkZXNjdWJyZW4gYXV0b23DoXRpY2FtZW50ZSBkZXNkZSBsYSBjYXJwZXRhIGFwaS9cclxuICAgIC8vIHkgc2UgY29uZmlndXJhbiB1c2FuZG8gZWwgbWV0YWRhdGEgZXhwb3J0YWRvIGVuIGNhZGEgYXJjaGl2b1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyDwn4aVIEFVVE8tRElTQ09WRVJZIERFIExBTUJEQVNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc29sZS5sb2coJ1xcbvCfmoAgU3RhcnRpbmcgTGFtYmRhIEF1dG8tRGlzY292ZXJ5Li4uJyk7XHJcblxyXG4gICAgLy8gRGVzY3VicmlyIHRvZGFzIGxhcyBsYW1iZGFzIGVuIC9hcGlcclxuICAgIGNvbnN0IGRpc2NvdmVyZWRMYW1iZGFzID0gZGlzY292ZXJMYW1iZGFzKCcuLi8uLi9hcGknKTtcclxuXHJcbiAgICAvLyBDcmVhciB1biBtYXBhIGRlIGxhbWJkYXMgY3JlYWRhcyBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICBjb25zdCBhdXRvTGFtYmRhcyA9IG5ldyBNYXA8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+KCk7XHJcbiAgICBjb25zdCBhdXRvUm91dGVNYXA6IFJlY29yZDxzdHJpbmcsIGxhbWJkYS5GdW5jdGlvbj4gPSB7fTtcclxuXHJcbiAgICAvLyBQcm9jZXNhciBUT0RBUyBsYXMgbGFtYmRhcyBkaXNjb3ZlcmVkIHF1ZSB0ZW5nYW4gbWV0YWRhdGEgdsOhbGlkYVxyXG4gICAgY29uc3QgbGFtYmRhc1RvQ3JlYXRlID0gZGlzY292ZXJlZExhbWJkYXMuZmlsdGVyKGwgPT4ge1xyXG4gICAgICAvLyBFeGNsdWlyIGxhbWJkYXMgcXVlIGNsYXJhbWVudGUgbm8gc29uIEFQSSBlbmRwb2ludHNcclxuICAgICAgY29uc3QgZXhjbHVkZWQgPSBbJ2hhbmRsZXInLCAnaW5kZXgnLCAnX3RlbXBsYXRlJywgJ3JlcXVpcmVMYXllciddO1xyXG4gICAgICByZXR1cm4gIWV4Y2x1ZGVkLmluY2x1ZGVzKGwubmFtZSkgJiYgbC5tZXRhZGF0YS5yb3V0ZTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKGBcXG7wn5OLIENyZWF0aW5nICR7bGFtYmRhc1RvQ3JlYXRlLmxlbmd0aH0gYXV0by1kaXNjb3ZlcmVkIGxhbWJkYXMuLi5cXG5gKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGRpc2NvdmVyZWQgb2YgbGFtYmRhc1RvQ3JlYXRlKSB7XHJcbiAgICAgIGNvbnN0IHsgbmFtZSwgbWV0YWRhdGEgfSA9IGRpc2NvdmVyZWQ7XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhg8J+UqCBDcmVhdGluZyBsYW1iZGE6ICR7bmFtZX1gKTtcclxuXHJcbiAgICAgIC8vIERldGVybWluYXIgcHJvZmlsZVxyXG4gICAgICBjb25zdCBwcm9maWxlID0gTEFNQkRBX1BST0ZJTEVTW21ldGFkYXRhLnByb2ZpbGUgfHwgJ21lZGl1bSddO1xyXG5cclxuICAgICAgLy8gQ29uc3RydWlyIGVudmlyb25tZW50IHZhcmlhYmxlcyBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICAgIGNvbnN0IGVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIEFQSV9VUkwgc2kgZXMgbmVjZXNhcmlvXHJcbiAgICAgIGVudmlyb25tZW50WydBUElfVVJMJ10gPSBhcGlVcmw7XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIFVTRVJfUE9PTF9JRCBzaSB0aWVuZSBwb2zDrXRpY2FzIGRlIENvZ25pdG9cclxuICAgICAgaWYgKG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcz8uc29tZShwID0+IHAucmVzb3VyY2VzPy5pbmNsdWRlcygndXNlcnBvb2wnKSkpIHtcclxuICAgICAgICBlbnZpcm9ubWVudFsnVVNFUl9QT09MX0lEJ10gPSBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQgfHwgJyc7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFncmVnYXIgU09VUkNFX0VNQUlMIHkgQ09OVEFDVF9FTUFJTCBzaSB0aWVuZSBwb2zDrXRpY2FzIGRlIFNFU1xyXG4gICAgICBpZiAobWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzPy5zb21lKHAgPT4gcC5hY3Rpb25zPy5pbmNsdWRlcygnc2VzOlNlbmRFbWFpbCcpKSkge1xyXG4gICAgICAgIGVudmlyb25tZW50WydTT1VSQ0VfRU1BSUwnXSA9IHByb2Nlc3MuZW52LlNPVVJDRV9FTUFJTCB8fCAnbm9yZXBseUBib3loYXBweS5jbCc7XHJcbiAgICAgICAgZW52aXJvbm1lbnRbJ0NPTlRBQ1RfRU1BSUwnXSA9IHByb2Nlc3MuZW52LkNPTlRBQ1RfRU1BSUwgfHwgJ2FkbWluQGJveWhhcHB5LmNsJztcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWdyZWdhciB2YXJpYWJsZXMgZGUgdGFibGEgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgICBpZiAobWV0YWRhdGEudGFibGVzKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCB0YWJsZVNwZWMgb2YgbWV0YWRhdGEudGFibGVzKSB7XHJcbiAgICAgICAgICBjb25zdCBbZW52S2V5XSA9IHRhYmxlU3BlYy5zcGxpdCgnOicpOyAgLy8gRWo6ICdBR0VOREFfVEFCTEUnXHJcbiAgICAgICAgICBjb25zdCB0YWJsZSA9IHRhYmxlc01hcC5nZXQoZW52S2V5KTtcclxuICAgICAgICAgIGlmICh0YWJsZSkge1xyXG4gICAgICAgICAgICAvLyBEaXJlY3RhbWVudGU6IEFHRU5EQV9UQUJMRSA9ICdBZ2VuZGFGb25vYXVkaW9sb2dpYSdcclxuICAgICAgICAgICAgZW52aXJvbm1lbnRbZW52S2V5XSA9IHRhYmxlLnRhYmxlTmFtZTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPICBUYWJsZSBub3QgZm91bmQgaW4gdGFibGVzTWFwOiAke2VudktleX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAgQXZhaWxhYmxlIGtleXM6ICR7QXJyYXkuZnJvbSh0YWJsZXNNYXAua2V5cygpKS5qb2luKCcsICcpfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWdyZWdhciB2YXJpYWJsZXMgZGUgYnVja2V0IGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgaWYgKG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1Y2tldFNwZWMgb2YgbWV0YWRhdGEuYnVja2V0cykge1xyXG4gICAgICAgICAgY29uc3QgW2J1Y2tldE5hbWVdID0gYnVja2V0U3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c01hcC5nZXQoYnVja2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuICAgICAgICAgIGlmIChidWNrZXQpIHtcclxuICAgICAgICAgICAgLy8gQ29udmVuY2nDs246IElNQUdFU19CVUNLRVQsIE1BVEVSSUFMRVNfQlVDS0VULCBldGMuXHJcbiAgICAgICAgICAgIGNvbnN0IGVudlZhck5hbWUgPSBgJHtidWNrZXROYW1lLnRvVXBwZXJDYXNlKCl9X0JVQ0tFVGA7XHJcbiAgICAgICAgICAgIGVudmlyb25tZW50W2VudlZhck5hbWVdID0gYnVja2V0LmJ1Y2tldE5hbWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBDcmVhciBsYSBsYW1iZGFcclxuICAgICAgY29uc3QgbGFtYmRhRnVuY3Rpb24gPSBjcmVhdGVMYW1iZGEoXHJcbiAgICAgICAgYCR7bmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5hbWUuc2xpY2UoMSl9TGFtYmRhYCxcclxuICAgICAgICBgYXBpLyR7bmFtZX1gLFxyXG4gICAgICAgICdoYW5kbGVyJyxcclxuICAgICAgICBlbnZpcm9ubWVudCxcclxuICAgICAgICBwcm9maWxlXHJcbiAgICAgICk7XHJcblxyXG4gICAgICAvLyBBdXRvLWdyYW50IHBlcm1pc29zXHJcbiAgICAgIGF1dG9HcmFudFBlcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uLCBtZXRhZGF0YSk7XHJcblxyXG4gICAgICAvLyBHdWFyZGFyIGVuIG1hcGFcclxuICAgICAgYXV0b0xhbWJkYXMuc2V0KG5hbWUsIGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgYXV0b1JvdXRlTWFwW21ldGFkYXRhLnJvdXRlXSA9IGxhbWJkYUZ1bmN0aW9uO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pyFICR7bmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHlcXG5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZyhgXFxu4pyFIEF1dG8tZGlzY292ZXJ5IGNvbXBsZXRlISAke2xhbWJkYXNUb0NyZWF0ZS5sZW5ndGh9IGxhbWJkYXMgY3JlYXRlZCBhdXRvbWF0aWNhbGx5XFxuYCk7XHJcbiAgICBjb25zb2xlLmxvZygn8J+TjSBBdXRvLWRpc2NvdmVyZWQgcm91dGVzOicsIE9iamVjdC5rZXlzKGF1dG9Sb3V0ZU1hcCkuam9pbignLCAnKSk7XHJcbiAgICBjb25zb2xlLmxvZygnXFxuJyArICc9Jy5yZXBlYXQoODApICsgJ1xcbicpO1xyXG5cclxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGUgcGFyYSBiYWNrdXBzIGRpYXJpb3MgYSBsYXMgMiBBTSBDaGlsZVxyXG4gICAgY29uc3QgYmFja3VwTGFtYmRhID0gYXV0b0xhbWJkYXMuZ2V0KCdiYWNrdXAnKTtcclxuICAgIGlmIChiYWNrdXBMYW1iZGEpIHtcclxuICAgICAgY29uc3QgYmFja3VwUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQmFja3VwRGlhcmlvUnVsZScsIHtcclxuICAgICAgICBydWxlTmFtZTogJ2JveWhhcHB5LWJhY2t1cC1kaWFyaW8nLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRWplY3V0YSBiYWNrdXAgYXV0b23DoXRpY28gZGlhcmlvIGEgbGFzIDIgQU0nLFxyXG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XHJcbiAgICAgICAgICBtaW51dGU6ICcwJyxcclxuICAgICAgICAgIGhvdXI6ICc2JywgLy8gNiBBTSBVVEMgPSAyIEFNIENoaWxlIChVVEMtNClcclxuICAgICAgICAgIGRheTogJyonLFxyXG4gICAgICAgICAgbW9udGg6ICcqJyxcclxuICAgICAgICAgIHllYXI6ICcqJ1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGVuYWJsZWQ6IHRydWVcclxuICAgICAgfSk7XHJcbiAgICAgIGJhY2t1cFJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGJhY2t1cExhbWJkYSkpO1xyXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJhY2t1cCBkaWFyaW8gY29uZmlndXJhZG8gY29ycmVjdGFtZW50ZVxcbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVzdWFyaW9zTGFtYmRhID0gYXV0b0xhbWJkYXMuZ2V0KCdVc3Vhcmlvc0xhbWJkYScpO1xyXG4gICAgaWYgKHVzdWFyaW9zTGFtYmRhKSB7XHJcbiAgICAgIGNvbnN0IHVzZXJQb29sSWQgPSBwcm9jZXNzLmVudi5DT0dOSVRPX1VTRVJfUE9PTF9JRDtcclxuICAgICAgY29uc29sZS5sb2coJ1VzZXIgUG9vbCBJRDonLCB1c2VyUG9vbElkKTtcclxuICAgICAgdXN1YXJpb3NMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJyxcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXAnXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpjb2duaXRvLWlkcDoke3Byb2Nlc3MuZW52LkFXU19SRUdJT059OiR7cHJvY2Vzcy5lbnYuQVdTX0FDQ09VTlRfSUR9OnVzZXJwb29sLyR7cHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEfWBdXHJcbiAgICAgIH0pKTtcclxuICAgICAgY29uc29sZS5sb2coJ+KchSBDb2duaXRvIHBvbGljeSBhZGRlZCB0byBVc3VhcmlvcyBMYW1iZGEnKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQ09ORklHVVJBQ0nDk04gREUgUk9VVElORyBFTiBBUEkgR0FURVdBWVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gVXNhciBTT0xPIGxhbWJkYXMgYXV0by1kZXNjdWJpZXJ0YXNcclxuICAgIGNvbnN0IHJvdXRlTWFwOiBSZWNvcmQ8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+ID0gYXV0b1JvdXRlTWFwO1xyXG5cclxuICAgIC8vIExhbWJkYSBSb3V0ZXIgY2VudHJhbGl6YWRvXHJcbiAgICBjb25zdCBhcGlSb3V0ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlSb3V0ZXJMYW1iZGEnLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxyXG5jb25zdCB7IExhbWJkYUNsaWVudCwgSW52b2tlQ29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWxhbWJkYScpO1xyXG5jb25zdCBsYW1iZGFDbGllbnQgPSBuZXcgTGFtYmRhQ2xpZW50KHt9KTtcclxuXHJcbmNvbnN0IFJPVVRFX01BUCA9ICR7SlNPTi5zdHJpbmdpZnkoXHJcbiAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKFxyXG4gICAgICAgICAgT2JqZWN0LmVudHJpZXMocm91dGVNYXApLm1hcCgoW3JvdXRlLCBmbl0pID0+IFtyb3V0ZSwgZm4uZnVuY3Rpb25OYW1lXSlcclxuICAgICAgICApXHJcbiAgICAgICl9O1xyXG5cclxuLy8gUm91dGVyIExhbWJkYSAtIFVwZGF0ZWQ6IDIwMjUtMTEtMjRUMjI6MDA6MDBaIC0gRml4IC9hcGkvIHByZWZpeCBoYW5kbGluZ1xyXG5leHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcclxuXHJcbiAgbGV0IHBhdGggPSBldmVudC5wYXRoIHx8ICcvJztcclxuICBjb25zdCBvcmlnaW5hbFBhdGggPSBwYXRoO1xyXG5cclxuICAvLyBFbGltaW5hciBwcmVmaWpvIC9hcGkvIHNpIGV4aXN0ZSAoZnJvbnRlbmQgcHVlZGUgZW52aWFyIC9hcGkvY2F0ZWdvcmlhcylcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvYXBpLycpKSB7XHJcbiAgICBwYXRoID0gcGF0aC5yZXBsYWNlKCcvYXBpLycsICcvJyk7XHJcbiAgICBjb25zb2xlLmxvZygnQ2xlYW5lZCAvYXBpLyBwcmVmaXg6Jywgb3JpZ2luYWxQYXRoLCAnLT4nLCBwYXRoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGJhc2VQYXRoID0gJy8nICsgKHBhdGguc3BsaXQoJy8nKVsxXSB8fCAnJyk7XHJcblxyXG4gIC8vIEJ1c2NhciBsYW1iZGEgcG9yIHJ1dGEgYmFzZVxyXG4gIGxldCB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbYmFzZVBhdGhdIHx8IFJPVVRFX01BUFtwYXRoXTtcclxuXHJcbiAgLy8gUnV0YXMgZXNwZWNpYWxlcyBjb24gc3ViLXBhdGhzXHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL25vdGFzL2FncnVwYWRhcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9ub3RhcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9ub3Rhcy9wcm9tZWRpb3MnKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbm90YXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9hcHJvYmFyJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL21hdGVyaWFsZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9yZWNoYXphcicpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9tYXRlcmlhbGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL21hdGVyaWFsZXMvY29ycmVnaXInKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbWF0ZXJpYWxlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9zZXNpb25lcy9hcmNoaXZvcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9zZXNpb25lcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9yZXBvcnRlcy8nKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvcmVwb3J0ZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvZXhwb3J0YXIvJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL2V4cG9ydGFyJ107XHJcblxyXG4gIC8vIOKaoO+4jyBFTElNSU5BRE86IFN0YXRpYyBmaWxlcyBhbmQgaG9tZSByb3V0aW5nXHJcbiAgLy8gRnJvbnRlbmQgaXMgbm93IHNlcnZlZCBmcm9tIFMzIFN0YXRpYyBXZWJzaXRlXHJcblxyXG4gIGlmICghdGFyZ2V0TGFtYmRhKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA0MDQsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdSb3V0ZSBub3QgZm91bmQnLCBwYXRoIH0pXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnNvbGUubG9nKCdJbnZva2luZyBsYW1iZGE6JywgdGFyZ2V0TGFtYmRhLCAnd2l0aCBwYXRoOicsIHBhdGgpO1xyXG5cclxuICAgIC8vIElNUE9SVEFOVEU6IE1vZGlmaWNhciBlbCBldmVudCBwYXJhIHF1ZSBlbCBwYXRoIG5vIHRlbmdhIC9hcGkvXHJcbiAgICAvLyBMb3MgbGFtYmRhcyBlc3BlcmFuIHJ1dGFzIHNpbiBlbCBwcmVmaWpvIC9hcGkvXHJcbiAgICBjb25zdCBtb2RpZmllZEV2ZW50ID0ge1xyXG4gICAgICAuLi5ldmVudCxcclxuICAgICAgcGF0aDogcGF0aCwgIC8vIFVzYXIgZWwgcGF0aCBsaW1waW8gKHNpbiAvYXBpLylcclxuICAgICAgcmVzb3VyY2U6IHBhdGhcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBsYW1iZGFDbGllbnQuc2VuZChuZXcgSW52b2tlQ29tbWFuZCh7XHJcbiAgICAgIEZ1bmN0aW9uTmFtZTogdGFyZ2V0TGFtYmRhLFxyXG4gICAgICBJbnZvY2F0aW9uVHlwZTogJ1JlcXVlc3RSZXNwb25zZScsXHJcbiAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KG1vZGlmaWVkRXZlbnQpXHJcbiAgICB9KSk7XHJcblxyXG4gICAgaWYgKHJlc3BvbnNlLkZ1bmN0aW9uRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignTGFtYmRhIGludm9jYXRpb24gZXJyb3I6JywgcmVzcG9uc2UuRnVuY3Rpb25FcnJvcik7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1BheWxvYWQ6JywgbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3BvbnNlLlBheWxvYWQpKTtcclxuXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogNTAyLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxyXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICBlcnJvcjogJ0xhbWJkYSBleGVjdXRpb24gZXJyb3InLFxyXG4gICAgICAgICAgZGV0YWlsczogcmVzcG9uc2UuRnVuY3Rpb25FcnJvcixcclxuICAgICAgICAgIHBheWxvYWQ6IG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5QYXlsb2FkKVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuUGF5bG9hZCkpO1xyXG4gICAgY29uc29sZS5sb2coJ0xhbWJkYSByZXNwb25zZSBzdGF0dXM6JywgcmVzdWx0LnN0YXR1c0NvZGUpO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoJ1JvdXRlciBlcnJvcjonLCBlcnJvcik7XHJcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzdGFjazonLCBlcnJvci5zdGFjayk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogNTAwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6ICd0cnVlJ1xyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCByb3V0aW5nIGVycm9yJyxcclxuICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxyXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xyXG4gICAgICB9KVxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcbiAgICAgIGApLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRGFyIHBlcm1pc29zIGFsIHJvdXRlciBwYXJhIGludm9jYXIgdG9kYXMgbGFzIGxhbWJkYXNcclxuICAgIE9iamVjdC52YWx1ZXMocm91dGVNYXApLmZvckVhY2goZm4gPT4ge1xyXG4gICAgICBmbi5ncmFudEludm9rZShhcGlSb3V0ZXJMYW1iZGEpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFQSSBHQVRFV0FZIFJPVVRJTkdcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBOT1RBOiBGcm9udGVuZCBzZSBzaXJ2ZSBkZXNkZSBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nIChGUkVFIFRJRVIpXHJcbiAgICAvLyAgICAgICBmcm9udGVuZFNlcnZlckxhbWJkYSBzb2xvIHNlIHVzYSBlbiBkZXYtc2VydmVyLmpzIGxvY2FsXHJcbiAgICAvLyAgICAgICBCYWNrZW5kIEFQSXMgc2UgYWNjZWRlbiBkaXJlY3RhbWVudGUgdmlhIEFQSSBHYXRld2F5XHJcblxyXG4gICAgLy8gUHJveHkgcGFyYSBBUElzIC0gdG9kYXMgbGFzIHJ1dGFzIHZhbiBhbCByb3V0ZXJcclxuICAgIGNvbnN0IHByb3h5ID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XHJcbiAgICBwcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaVJvdXRlckxhbWJkYSkpO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEZSRUUgVElFUjogTk8gQ0xPVURGUk9OVFxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQ2xvdWRGcm9udCBzZSBoYSBlbGltaW5hZG8gcGFyYSBtYW50ZW5lcnNlIGVuIGVsIEZyZWUgVGllclxyXG4gICAgLy8gRWwgZnJvbnRlbmQgc2Ugc2lydmUgZGVzZGUgUzMgU3RhdGljIFdlYnNpdGUgSG9zdGluZ1xyXG4gICAgLy8gTElNSVRBQ0nDk046IFNvbG8gSFRUUCAobm8gSFRUUFMpIGEgbWVub3MgcXVlIHVzZXMgQ2xvdWRGcm9udCAoY29zdG8gZXh0cmEpXHJcbiAgICAvL1xyXG4gICAgLy8gUGFyYSBoYWJpbGl0YXIgSFRUUFMgZW4gZWwgZnV0dXJvIChjb24gY29zdG8pOlxyXG4gICAgLy8gMS4gRGVzY29tZW50YXIgZWwgY8OzZGlnbyBkZSBDbG91ZEZyb250IG3DoXMgYWJham9cclxuICAgIC8vIDIuIEFjdHVhbGl6YXIgZnJvbnRlbmRCdWNrZXQgcGFyYSB1c2FyIE9BSSBlbiBsdWdhciBkZSBwdWJsaWNSZWFkQWNjZXNzXHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ltYWdlc0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBpbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNYXRlcmlhbGVzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IG1hdGVyaWFsZXNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCYWNrdXBzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IGJhY2t1cHNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdCdWNrZXQgZGUgYmFja3VwcyBhdXRvbcOhdGljb3MgKHJldGVuY2nDs24gMzAgZMOtYXMpJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0J1Y2tldCBTMyBwYXJhIGFyY2hpdm9zIGVzdMOhdGljb3MgZGVsIGZyb250ZW5kJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0JveUhhcHB5RnJvbnRlbmRCdWNrZXQnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRXZWJzaXRlVVJMJywge1xyXG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0V2Vic2l0ZVVybCxcclxuICAgICAgZGVzY3JpcHRpb246ICfwn4yQIFVSTCBkZWwgRnJvbnRlbmQgKFMzIFN0YXRpYyBXZWJzaXRlIC0gRlJFRSBUSUVSKSAtIFVTQVIgRVNUQSBVUkwnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQm95SGFwcHlGcm9udGVuZFVSTCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5VVJMJywge1xyXG4gICAgICB2YWx1ZTogYXBpLnVybCxcclxuICAgICAgZGVzY3JpcHRpb246ICfwn5SXIFVSTCBkZSBBUEkgR2F0ZXdheSAoQmFja2VuZCBBUElzKScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdCb3lIYXBweUFwaVVSTCdcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE5PVEE6IExvcyBub21icmVzIGRlIHRhYmxhcyBOTyBzZSBleHBvcnRhbiBjb21vIG91dHB1dHMgcG9ycXVlOlxyXG4gICAgLy8gLSBMYXMgbGFtYmRhcyByZWNpYmVuIGxvcyBub21icmVzIGF1dG9tw6F0aWNhbWVudGUgdsOtYSBhdXRvLWlueWVjY2nDs24gQ0RLXHJcbiAgICAvLyAtIE5vIGhheSBzY3JpcHRzIGV4dGVybm9zIHF1ZSBuZWNlc2l0ZW4gYWNjZWRlciBhIGVzdG9zIHZhbG9yZXNcclxuICAgIC8vIC0gTWFudGllbmUgb3V0cHV0cy5qc29uIHNpbXBsZSB5IHNvbG8gY29uIGluZm9ybWFjacOzbiDDunRpbCBwYXJhIGVsIHVzdWFyaW9cclxuICB9XHJcbn1cclxuIl19