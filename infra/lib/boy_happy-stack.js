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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELDJEQUE2QztBQUU3Qyx1REFBeUM7QUFDekMseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFJMUQsK0NBQWlDO0FBQ2pDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBRWxDLG9FQUFvRTtBQUNwRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQTRCNUQsNkNBQTZDO0FBQzdDLHFDQUFxQztBQUNyQyw2Q0FBNkM7QUFFN0M7OztHQUdHO0FBQ0gsU0FBUyxlQUFlLENBQUMsU0FBaUI7SUFDeEMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFFeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUU1RCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUNBQW1DLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDaEUsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0lBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUM7U0FDdkMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMs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Z0JBQWdCLENBQUMsVUFBVTtTQUNuQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxhQUFhLENBQUMsVUFBVTtZQUMvQixXQUFXLEVBQUUsbURBQW1EO1NBQ2pFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxVQUFVO1lBQ2hDLFdBQVcsRUFBRSxnREFBZ0Q7WUFDN0QsVUFBVSxFQUFFLHdCQUF3QjtTQUNyQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCO1lBQ3RDLFdBQVcsRUFBRSxxRUFBcUU7WUFDbEYsVUFBVSxFQUFFLHFCQUFxQjtTQUNsQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7WUFDZCxXQUFXLEVBQUUsc0NBQXNDO1lBQ25ELFVBQVUsRUFBRSxnQkFBZ0I7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsa0VBQWtFO1FBQ2xFLDJFQUEyRTtRQUMzRSxrRUFBa0U7UUFDbEUsNkVBQTZFO0lBQy9FLENBQUM7Q0FDRjtBQWwyQkQsc0NBazJCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XHJcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcclxuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XHJcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XHJcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcclxuaW1wb3J0ICogYXMgZG90ZW52IGZyb20gJ2RvdGVudic7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmRvdGVudi5jb25maWcoeyBwYXRoOiAnLi8uZW52JyB9KTtcclxuXHJcbi8vIEltcG9ydGFyIGNvbnN0YW50ZXMgZGUgbm9tYnJlcyBkZSB0YWJsYXMgKMO6bmljYSBmdWVudGUgZGUgdmVyZGFkKVxyXG5jb25zdCBUQUJMRV9OQU1FUyA9IHJlcXVpcmUoJy4uLy4uL3NoYXJlZC90YWJsZS1uYW1lcy5janMnKTtcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBUSVBPUyBQQVJBIEFVVE8tRElTQ09WRVJZIERFIExBTUJEQVNcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5pbnRlcmZhY2UgTGFtYmRhTWV0YWRhdGEge1xyXG4gIHJvdXRlOiBzdHJpbmc7XHJcbiAgbWV0aG9kcz86IHN0cmluZ1tdO1xyXG4gIGF1dGg/OiBib29sZWFuO1xyXG4gIGF1dGhFeGNlcHRpb25zPzogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XHJcbiAgcm9sZXM/OiBzdHJpbmdbXTtcclxuICBwcm9maWxlPzogJ2xpZ2h0JyB8ICdtZWRpdW0nIHwgJ2hlYXZ5JztcclxuICB0YWJsZXM/OiBzdHJpbmdbXTtcclxuICBidWNrZXRzPzogc3RyaW5nW107XHJcbiAgYWRkaXRpb25hbFBvbGljaWVzPzogQXJyYXk8e1xyXG4gICAgYWN0aW9uczogc3RyaW5nW107XHJcbiAgICByZXNvdXJjZXM6IHN0cmluZ1tdO1xyXG4gIH0+O1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRGlzY292ZXJlZExhbWJkYSB7XHJcbiAgbmFtZTogc3RyaW5nOyAgICAgICAgICAgICAgLy8gTm9tYnJlIGRlbCBhcmNoaXZvIHNpbiAuanNcclxuICBmaWxlTmFtZTogc3RyaW5nOyAgICAgICAgICAvLyBOb21icmUgY29tcGxldG8gZGVsIGFyY2hpdm9cclxuICBmaWxlUGF0aDogc3RyaW5nOyAgICAgICAgICAvLyBSdXRhIGFic29sdXRhIGFsIGFyY2hpdm9cclxuICBtZXRhZGF0YTogTGFtYmRhTWV0YWRhdGE7ICAvLyBNZXRhZGF0YSBleHBvcnRhZGFcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIEZVTkNJw5NOOiBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIERlc2N1YnJlIGF1dG9tw6F0aWNhbWVudGUgdG9kYXMgbGFzIGxhbWJkYXMgZW4gZWwgZGlyZWN0b3JpbyBlc3BlY2lmaWNhZG9cclxuICogeSBleHRyYWUgc3UgbWV0YWRhdGEgcGFyYSBhdXRvLWNvbmZpZ3VyYWNpw7NuXHJcbiAqL1xyXG5mdW5jdGlvbiBkaXNjb3ZlckxhbWJkYXMobGFtYmRhRGlyOiBzdHJpbmcpOiBEaXNjb3ZlcmVkTGFtYmRhW10ge1xyXG4gIGNvbnN0IGFic29sdXRlUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIGxhbWJkYURpcik7XHJcblxyXG4gIGNvbnNvbGUubG9nKGBcXG7wn5SNIERpc2NvdmVyaW5nIGxhbWJkYXMgaW46ICR7YWJzb2x1dGVQYXRofWApO1xyXG5cclxuICBpZiAoIWZzLmV4aXN0c1N5bmMoYWJzb2x1dGVQYXRoKSkge1xyXG4gICAgY29uc29sZS53YXJuKGDimqDvuI8gIExhbWJkYSBkaXJlY3Rvcnkgbm90IGZvdW5kOiAke2Fic29sdXRlUGF0aH1gKTtcclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmMoYWJzb2x1dGVQYXRoKVxyXG4gICAgLmZpbHRlcihmID0+IGYuZW5kc1dpdGgoJy5qcycpICYmICFmLnN0YXJ0c1dpdGgoJ18nKSAmJiAhZi5zdGFydHNXaXRoKCcuJykpO1xyXG5cclxuICBjb25zb2xlLmxvZyhg8J+TpiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gbGFtYmRhIGZpbGVzYCk7XHJcblxyXG4gIGNvbnN0IGRpc2NvdmVyZWQ6IERpc2NvdmVyZWRMYW1iZGFbXSA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgIGNvbnN0IG5hbWUgPSBmaWxlLnJlcGxhY2UoJy5qcycsICcnKTtcclxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGFic29sdXRlUGF0aCwgZmlsZSk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gSW50ZW50YXIgY2FyZ2FyIGVsIG3Ds2R1bG8gcGFyYSBsZWVyIG1ldGFkYXRhXHJcbiAgICAgIC8vIE5PVEE6IEVuIHRpZW1wbyBkZSBDREsgc3ludGgsIGVzdG8gcmVxdWllcmUgcXVlIGxvcyBtw7NkdWxvcyBzZWFuIHbDoWxpZG9zXHJcbiAgICAgIC8vIFNpIGhheSBlcnJvcmVzIGRlIHJlcXVpcmUgKGZhbHRhbiBkZXBzKSwgdXNhbW9zIG1ldGFkYXRhIHBvciBkZWZlY3RvXHJcbiAgICAgIGRlbGV0ZSByZXF1aXJlLmNhY2hlW3JlcXVpcmUucmVzb2x2ZShmaWxlUGF0aCldO1xyXG4gICAgICBjb25zdCBtb2R1bGUgPSByZXF1aXJlKGZpbGVQYXRoKTtcclxuXHJcbiAgICAgIGNvbnN0IG1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YSA9IG1vZHVsZS5tZXRhZGF0YSB8fCB7XHJcbiAgICAgICAgcm91dGU6IGAvJHtuYW1lfWAsXHJcbiAgICAgICAgbWV0aG9kczogWydHRVQnLCAnUE9TVCddLFxyXG4gICAgICAgIGF1dGg6IHRydWUsXHJcbiAgICAgICAgcm9sZXM6IFsnKiddLFxyXG4gICAgICAgIHByb2ZpbGU6ICdtZWRpdW0nLFxyXG4gICAgICAgIHRhYmxlczogW11cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGRpc2NvdmVyZWQucHVzaCh7XHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBmaWxlTmFtZTogZmlsZSxcclxuICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICBtZXRhZGF0YVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKGAgIOKchSAke25hbWV9OiAke21ldGFkYXRhLnJvdXRlfSBbJHttZXRhZGF0YS5wcm9maWxlfV0gJHttZXRhZGF0YS5hdXRoID8gJ/CflJInIDogJ/CfjJAnfWApO1xyXG5cclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS53YXJuKGAgIOKaoO+4jyAgQ291bGQgbm90IGxvYWQgbWV0YWRhdGEgZm9yICR7ZmlsZX06YCwgZXJyb3IubWVzc2FnZSk7XHJcblxyXG4gICAgICAvLyBVc2FyIG1ldGFkYXRhIHBvciBkZWZlY3RvIHNpIG5vIHNlIHB1ZWRlIGNhcmdhclxyXG4gICAgICBjb25zdCBkZWZhdWx0TWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhID0ge1xyXG4gICAgICAgIHJvdXRlOiBgLyR7bmFtZX1gLFxyXG4gICAgICAgIG1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnXSxcclxuICAgICAgICBhdXRoOiB0cnVlLFxyXG4gICAgICAgIHJvbGVzOiBbJyonXSxcclxuICAgICAgICBwcm9maWxlOiAnbWVkaXVtJyxcclxuICAgICAgICB0YWJsZXM6IFtdXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBkaXNjb3ZlcmVkLnB1c2goe1xyXG4gICAgICAgIG5hbWUsXHJcbiAgICAgICAgZmlsZU5hbWU6IGZpbGUsXHJcbiAgICAgICAgZmlsZVBhdGgsXHJcbiAgICAgICAgbWV0YWRhdGE6IGRlZmF1bHRNZXRhZGF0YVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKGAgIOKaoO+4jyAgJHtuYW1lfTogVXNpbmcgZGVmYXVsdCBtZXRhZGF0YWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc29sZS5sb2coYFxcbuKchSBEaXNjb3ZlcnkgY29tcGxldGU6ICR7ZGlzY292ZXJlZC5sZW5ndGh9IGxhbWJkYXMgY29uZmlndXJlZFxcbmApO1xyXG5cclxuICByZXR1cm4gZGlzY292ZXJlZDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEJveUhhcHB5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEJ1Y2tldHMgUzNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0ltYWdlc0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYGJveWhhcHB5LWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG1hdGVyaWFsZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdNYXRlcmlhbGVzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktbWF0ZXJpYWxlcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgY29yczogW3tcclxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVF0sXHJcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBiYWNrdXBzIGF1dG9tw6F0aWNvc1xyXG4gICAgLy8gRlJFRSBUSUVSOiBTaW4gdmVyc2lvbmFkbyBwYXJhIGV2aXRhciBjb3N0b3MgYWRpY2lvbmFsZXNcclxuICAgIGNvbnN0IGJhY2t1cHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWNrdXBzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktYmFja3Vwcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sIC8vIFJFVEFJTiBwYXJhIG5vIHBlcmRlciBiYWNrdXBzXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIEZSRUUgVElFUjogRGVzYWN0aXZhZG8gcGFyYSBldml0YXIgY29zdG9zXHJcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbe1xyXG4gICAgICAgIC8vIFJldGVuZXIgc29sbyA3IGTDrWFzIGRlIGJhY2t1cHMgcGFyYSBtYW50ZW5lcnNlIGVuIEZyZWUgVGllclxyXG4gICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBmcm9udGVuZCBlc3TDoXRpY28gKEhUTUwvQ1NTL0pTKVxyXG4gICAgLy8gRlJFRSBUSUVSOiBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nIChzaW4gQ2xvdWRGcm9udCBwYXJhIGV2aXRhciBjb3N0b3MpXHJcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktZnJvbnRlbmQtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIC8vIENvbmZpZ3VyYWNpw7NuIHBhcmEgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAocMO6YmxpY28pXHJcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXHJcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSBmYWxsYmFja1xyXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLCAvLyBQZXJtaXRlIGFjY2VzbyBww7pibGljbyBwYXJhIFN0YXRpYyBXZWJzaXRlXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xyXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcclxuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2VcclxuICAgICAgfSksXHJcbiAgICAgIGNvcnM6IFt7XHJcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcclxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ11cclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFRBQkxBUyBEWU5BTU9EQiBPUFRJTUlaQURBU1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgIC8vIDEuIFRBQkxBIFVTVUFSSU9TXHJcbiAgICAvLyBGUkVFIFRJRVI6IFBST1ZJU0lPTkVEIG1vZGUgY29uIDUgUkNVL1dDVSAoZ3JhdGlzIHBlcm1hbmVudGVtZW50ZSlcclxuICAgIGNvbnN0IHVzdWFyaW9zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzdWFyaW9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuVVNVQVJJT1NfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDUsICAvLyBGUkVFIFRJRVI6IDI1IFJDVSB0b3RhbGVzIGNvbXBhcnRpZGFzIGVudHJlIHRvZGFzIGxhcyB0YWJsYXNcclxuICAgICAgd3JpdGVDYXBhY2l0eTogNSwgLy8gRlJFRSBUSUVSOiAyNSBXQ1UgdG90YWxlcyBjb21wYXJ0aWRhcyBlbnRyZSB0b2RhcyBsYXMgdGFibGFzXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICB1c3Vhcmlvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRW1haWxJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY29ycmVvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDIuIFRBQkxBIENPTVVOSUNBQ0lPTkVTIChmdXNpb25hIEFudW5jaW9zICsgRXZlbnRvcyArIE1hdHJpY3VsYXMpXHJcbiAgICBjb25zdCBjb211bmljYWNpb25lc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb211bmljYWNpb25lc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkNPTVVOSUNBQ0lPTkVTX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBmaWx0cmFyIHBvciB0aXBvIHkgZmVjaGFcclxuICAgIGNvbXVuaWNhY2lvbmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGZpbHRyYXIgbWF0csOtY3VsYXMgcG9yIGVzdGFkb1xyXG4gICAgY29tdW5pY2FjaW9uZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VzdGFkb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlc3RhZG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMy4gVEFCTEEgQVNJU1RFTkNJQVxyXG4gICAgY29uc3QgYXNpc3RlbmNpYVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBc2lzdGVuY2lhVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVNJU1RFTkNJQV9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgYXNpc3RlbmNpYVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29GZWNoYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjdXJzbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGFzaXN0ZW5jaWFUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0LiBUQUJMQSBSRUNVUlNPUyBBQ0FERU1JQ09TIChmdXNpb25hIE5vdGFzICsgTWF0ZXJpYWxlcyArIEJpdMOhY29yYSArIENhdGVnb3LDrWFzKVxyXG4gICAgY29uc3QgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JlY3Vyc29zQWNhZGVtaWNvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlJFQ1VSU09TX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBhbHVtbm8gKG5vdGFzKVxyXG4gICAgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBjdXJzbyB5IGFzaWduYXR1cmFcclxuICAgIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29Bc2lnbmF0dXJhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXNpZ25hdHVyYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBqZXJhcnF1w61hIGRlIGNhdGVnb3LDrWFzIChwYXJlbnQtY2hpbGQpXHJcbiAgICByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1BhcmVudENhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwYXJlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKchSBHU0kgcGFyYSBidXNjYXIgc29sbyBwb3IgSUQgKHNpbiB0aXBvKSAtIFBlcm1pdGUgR2V0Q29tbWFuZCBjb24gc29sbyB7aWR9XHJcbiAgICAvLyBOT1RBOiBBdW5xdWUgc2UgcHVlZGUgdXNhciBHZXRDb21tYW5kIGNvbiB7aWQsIHRpcG99LCBlc3RlIEdTSSBwZXJtaXRlIHF1ZXJpZXMgbcOhcyBmbGV4aWJsZXNcclxuICAgIC8vIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgIC8vICAgaW5kZXhOYW1lOiAnSWRJbmRleCcsXHJcbiAgICAvLyAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgLy8gICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgLy8gfSk7XHJcbiAgICAvLyBDT01FTlRBRE86IEVuIHJlYWxpZGFkIG5vIGVzIG5lY2VzYXJpbyB1biBHU0kgcGFyYSBHZXRDb21tYW5kLlxyXG4gICAgLy8gR2V0Q29tbWFuZCBmdW5jaW9uYSBjb24gcGFydGl0aW9uIGtleSArIHNvcnQga2V5OiB7aWQsIHRpcG99XHJcbiAgICAvLyBFbCBiYWNrZW5kIGZ1ZSBhY3R1YWxpemFkbyBwYXJhIGZ1bmNpb25hciBhc8OtLlxyXG5cclxuICAgIC8vIDUuIFRBQkxBIFJFVFJPQUxJTUVOVEFDSU9OICh1bmlmaWNhIHRvZGFzIGxhcyBvYnNlcnZhY2lvbmVzKVxyXG4gICAgY29uc3QgcmV0cm9hbGltZW50YWNpb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmV0cm9hbGltZW50YWNpb25UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5SRVRST0FMSU1FTlRBQ0lPTl9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRVc3VhcmlvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBjb25zdWx0YXMgcG9yIG9yaWdlbiB5IGZlY2hhXHJcbiAgICByZXRyb2FsaW1lbnRhY2lvblRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnT3JpZ2VuRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnb3JpZ2VuJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNi4gVEFCTEEgQUdFTkRBIEZPTk9BVURJT0xPR0lBIChyZW5vbWJyYWRhKVxyXG4gICAgY29uc3QgYWdlbmRhRm9ub1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBZ2VuZGFGb25vVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQUdFTkRBX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZlY2hhSG9yYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNy4gVEFCTEEgQ09ORklHVVJBQ0lPTlxyXG4gICAgY29uc3QgY29uZmlndXJhY2lvblRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb25maWd1cmFjaW9uVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQ09ORklHVVJBQ0lPTl9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAxLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAxLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNy41LiBUQUJMQSBNQVRFUklBTENBVEVHT1JJQVMgKFJlbGFjacOzbiBNYW55LXRvLU1hbnkpXHJcbiAgICBjb25zdCBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTWF0ZXJpYWxDYXRlZ29yaWFzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuTUFURVJJQUxfQ0FURUdPUklBU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdtYXRlcmlhbElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY2F0ZWdvcmlhSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBBdXRvLXNjYWxpbmcgcGFyYSBtZWpvciBlc2NhbGFiaWxpZGFkXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgaW52ZXJzbyBwYXJhIGNvbnN1bHRhciBtYXRlcmlhbGVzIHBvciBjYXRlZ29yw61hXHJcbiAgICBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0NhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjYXRlZ29yaWFJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ21hdGVyaWFsSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gOC4gVEFCTEEgSU5GT1JNRVMgKE5VRVZBIC0gRkFTRSA1KVxyXG4gICAgY29uc3QgaW5mb3JtZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW5mb3JtZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5JTkZPUk1FU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaW5mb3JtZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICBpbmZvcm1lc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDkuIFRBQkxBIFJFUE9SVEVTIChOVUVWQSAtIEZBU0UgOSlcclxuICAgIGNvbnN0IHJlcG9ydGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JlcG9ydGVzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuUkVQT1JURVNfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlcG9ydGVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTAuIFRBQkxBIEFQT0RFUkFET1MgKE5VRVZBIC0gUmVsYWNpb25lcyBBcG9kZXJhZG8tQWx1bW5vKVxyXG4gICAgY29uc3QgYXBvZGVyYWRvc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBcG9kZXJhZG9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVBPREVSQURPU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGLDunNxdWVkYSBwb3IgY29ycmVvXHJcbiAgICBhcG9kZXJhZG9zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFbWFpbEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjb3JyZW8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTEuIFRBQkxBIEFQT0RFUkFETy1BTFVNTk8gKFJlbGFjacOzbiBOOk4pXHJcbiAgICBjb25zdCBhcG9kZXJhZG9BbHVtbm9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXBvZGVyYWRvQWx1bW5vVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuQVBPREVSQURPX0FMVU1OT19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIHF1ZXJpZXMgaW52ZXJzYXMgKGJ1c2NhciBhcG9kZXJhZG9zIHBvciBhbHVtbm8pXHJcbiAgICBhcG9kZXJhZG9BbHVtbm9UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTIuIFRBQkxBIFBST0ZFU09SLUNVUlNPIChSZWxhY2nDs24gMTpOIGNvbiB0aXBvcylcclxuICAgIGNvbnN0IHByb2Zlc29yQ3Vyc29UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvZmVzb3JDdXJzb1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlBST0ZFU09SX0NVUlNPX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Byb2Zlc29yUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3Vyc29UaXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gXCIxQSNqZWZlXCIgbyBcIjFBI2FzaWduYXR1cmEjTWF0ZW3DoXRpY2FzXCJcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBsaXN0YXIgcHJvZmVzb3JlcyBkZSB1biBjdXJzb1xyXG4gICAgcHJvZmVzb3JDdXJzb1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY3Vyc28nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIExhbWJkYSBMYXllciBjb24gZGVwZW5kZW5jaWFzIGNvbXVuZXNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0NvbW1vbkRlcGVuZGVuY2llc0xheWVyJywge1xyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2xheWVycy9jb21tb24nKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1hdLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FXUyBTREsgdjMgKyB1dGlsaWRhZGVzIGNvbXVuZXMgKHJlc3BvbnNlLCBsb2dnZXIsIHZhbGlkYXRpb24pJyxcclxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogJ2JveWhhcHB5LWNvbW1vbi1kZXBlbmRlbmNpZXMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gSGVscGVyIHBhcmEgY3JlYXIgTGFtYmRhcyBjb24gY29uZmlndXJhY2nDs24gb3B0aW1pemFkYVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgaW50ZXJmYWNlIExhbWJkYUNvbmZpZyB7XHJcbiAgICAgIG1lbW9yeT86IG51bWJlcjtcclxuICAgICAgdGltZW91dD86IG51bWJlcjtcclxuICAgICAgY29uY3VycmVuY3k/OiBudW1iZXI7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgTEFNQkRBX1BST0ZJTEVTID0ge1xyXG4gICAgICBsaWdodDogeyBtZW1vcnk6IDI1NiwgdGltZW91dDogMTAgfSwgICAgLy8gQXV0aCwgY2FsbGJhY2tzXHJcbiAgICAgIG1lZGl1bTogeyBtZW1vcnk6IDUxMiwgdGltZW91dDogMTUgfSwgICAvLyBDUlVEIG9wZXJhdGlvbnNcclxuICAgICAgaGVhdnk6IHsgbWVtb3J5OiAxMDI0LCB0aW1lb3V0OiAzMCB9LCAgIC8vIFJlcG9ydGVzLCBTMywgYmFja3Vwc1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBjcmVhdGVMYW1iZGEgPSAoXHJcbiAgICAgIG5hbWU6IHN0cmluZyxcclxuICAgICAgaGFuZGxlckZpbGU6IHN0cmluZyxcclxuICAgICAgaGFuZGxlck5hbWU6IHN0cmluZyA9ICdoYW5kbGVyJyxcclxuICAgICAgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSxcclxuICAgICAgY29uZmlnOiBMYW1iZGFDb25maWcgPSBMQU1CREFfUFJPRklMRVMubWVkaXVtXHJcbiAgICApID0+IHtcclxuICAgICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgbmFtZSwge1xyXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICAgIGhhbmRsZXI6IGAke2hhbmRsZXJGaWxlfS4ke2hhbmRsZXJOYW1lfWAsXHJcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLicsIHtcclxuICAgICAgICAgIGV4Y2x1ZGU6IFtcclxuICAgICAgICAgICAgJ2luZnJhLyoqJyxcclxuICAgICAgICAgICAgJ2Zyb250ZW5kLyoqJyxcclxuICAgICAgICAgICAgJ3NjcmlwdHMvKionLFxyXG4gICAgICAgICAgICAnZGlzdC8qKicsXHJcbiAgICAgICAgICAgICcqLm1kJyxcclxuICAgICAgICAgICAgJy5naXQvKionLFxyXG4gICAgICAgICAgICAnbm9kZV9tb2R1bGVzLyoqJyxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAuLi5lbnZpcm9ubWVudCxcclxuICAgICAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScsXHJcbiAgICAgICAgICBOT0RFX09QVElPTlM6ICctLWVuYWJsZS1zb3VyY2UtbWFwcycsXHJcbiAgICAgICAgICBMQVNUX0RFUExPWTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLnRpbWVvdXQgfHwgMTApLFxyXG4gICAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5tZW1vcnkgfHwgMzg0LFxyXG4gICAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQVBJIEdBVEVXQVkgLSBDUkVBUiBQUklNRVJPIFBBUkEgT0JURU5FUiBMQSBVUkxcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0JveUhhcHB5QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ0JveUhhcHB5IFNlcnZpY2UnLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgIC8vIENPUlM6IE9yw61nZW5lcyBlc3BlY8OtZmljb3MgcGFyYSBkZXNhcnJvbGxvIGxvY2FsICsgcHJvZHVjY2nDs24gUzNcclxuICAgICAgICAvLyBDUklUSUNBTDogYWxsb3dDcmVkZW50aWFsczogdHJ1ZSByZXF1aWVyZSBvcsOtZ2VuZXMgZXNwZWPDrWZpY29zIChOTyB3aWxkY2FyZHMpXHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbXHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDA1JywgICAgIC8vIEZyb250ZW5kIGRldiBzZXJ2ZXIgKFZpdGUgZGVmYXVsdClcclxuICAgICAgICAgICdodHRwOi8vMTI3LjAuMC4xOjMwMDUnLFxyXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsICAgICAvLyBGYWxsYmFjayBkZXYgcG9ydFxyXG4gICAgICAgICAgJ2h0dHA6Ly8xMjcuMC4wLjE6MzAwMCcsXHJcbiAgICAgICAgICBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsICAvLyBTMyBTdGF0aWMgV2Vic2l0ZSBVUkwgKHByb2R1Y2Npw7NuKVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxyXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXHJcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXHJcbiAgICAgICAgICAnQ29va2llJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcclxuICAgICAgICBtYXhBZ2U6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKVxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uc3RydWlyIGxhIFVSTCBkZWwgQVBJIEdhdGV3YXkgbWFudWFsbWVudGUgc2luIGNyZWFyIGRlcGVuZGVuY2lhIGNpcmN1bGFyXHJcbiAgICBjb25zdCBhcGlVcmwgPSBgaHR0cHM6Ly8ke2FwaS5yZXN0QXBpSWR9LmV4ZWN1dGUtYXBpLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vcHJvZGA7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gTUFQQSBERSBUQUJMQVMgUEFSQSBBVVRPLUdSQU5UXHJcbiAgICAvLyBVc2EgbGFzIENMQVZFUyBkZWwgLmVudiBjb21vIGtleXMgKMO6bmljYSBmdWVudGUgZGUgdmVyZGFkKVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgdGFibGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPihbXHJcbiAgICAgIFsnVVNVQVJJT1NfVEFCTEUnLCB1c3Vhcmlvc1RhYmxlXSxcclxuICAgICAgWydDT01VTklDQUNJT05FU19UQUJMRScsIGNvbXVuaWNhY2lvbmVzVGFibGVdLFxyXG4gICAgICBbJ1JFQ1VSU09TX1RBQkxFJywgcmVjdXJzb3NBY2FkZW1pY29zVGFibGVdLFxyXG4gICAgICBbJ0FTSVNURU5DSUFfVEFCTEUnLCBhc2lzdGVuY2lhVGFibGVdLFxyXG4gICAgICBbJ0FHRU5EQV9UQUJMRScsIGFnZW5kYUZvbm9UYWJsZV0sXHJcbiAgICAgIFsnQ09ORklHVVJBQ0lPTl9UQUJMRScsIGNvbmZpZ3VyYWNpb25UYWJsZV0sXHJcbiAgICAgIFsnSU5GT1JNRVNfVEFCTEUnLCBpbmZvcm1lc1RhYmxlXSxcclxuICAgICAgWydSRVBPUlRFU19UQUJMRScsIHJlcG9ydGVzVGFibGVdLFxyXG4gICAgICBbJ0FQT0RFUkFET1NfVEFCTEUnLCBhcG9kZXJhZG9zVGFibGVdLFxyXG4gICAgICBbJ0FQT0RFUkFET19BTFVNTk9fVEFCTEUnLCBhcG9kZXJhZG9BbHVtbm9UYWJsZV0sXHJcbiAgICAgIFsnUFJPRkVTT1JfQ1VSU09fVEFCTEUnLCBwcm9mZXNvckN1cnNvVGFibGVdLFxyXG4gICAgICBbJ1JFVFJPQUxJTUVOVEFDSU9OX1RBQkxFJywgcmV0cm9hbGltZW50YWNpb25UYWJsZV0sXHJcbiAgICAgIFsnTUFURVJJQUxfQ0FURUdPUklBU19UQUJMRScsIG1hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlXVxyXG4gICAgXSk7XHJcblxyXG4gICAgY29uc3QgYnVja2V0c01hcCA9IG5ldyBNYXA8c3RyaW5nLCBzMy5CdWNrZXQ+KFtcclxuICAgICAgWydpbWFnZXMnLCBpbWFnZXNCdWNrZXRdLFxyXG4gICAgICBbJ21hdGVyaWFsZXMnLCBtYXRlcmlhbGVzQnVja2V0XSxcclxuICAgICAgWydiYWNrdXBzJywgYmFja3Vwc0J1Y2tldF0sXHJcbiAgICAgIFsnZnJvbnRlbmQnLCBmcm9udGVuZEJ1Y2tldF1cclxuICAgIF0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEZVTkNJw5NOOiBBVVRPLUdSQU5UIFBFUk1JU1NJT05TXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvKipcclxuICAgICAqIE90b3JnYSBwZXJtaXNvcyBhdXRvbcOhdGljYW1lbnRlIGJhc8OhbmRvc2UgZW4gbGEgbWV0YWRhdGEgZGUgbGEgbGFtYmRhXHJcbiAgICAgKi9cclxuICAgIGNvbnN0IGF1dG9HcmFudFBlcm1pc3Npb25zID0gKFxyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uLFxyXG4gICAgICBtZXRhZGF0YTogTGFtYmRhTWV0YWRhdGFcclxuICAgICkgPT4ge1xyXG4gICAgICAvLyAxLiBQZXJtaXNvcyBkZSBEeW5hbW9EQiBUYWJsZXNcclxuICAgICAgaWYgKG1ldGFkYXRhLnRhYmxlcyAmJiBtZXRhZGF0YS50YWJsZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgdGFibGVTcGVjIG9mIG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgICAgLy8gRm9ybWF0bzogXCJUYWJsZU5hbWVcIiBvIFwiVGFibGVOYW1lOnJlYWRcIiBvIFwiVGFibGVOYW1lOndyaXRlXCJcclxuICAgICAgICAgIGNvbnN0IFt0YWJsZU5hbWUsIGFjY2Vzc1R5cGUgPSAncmVhZHdyaXRlJ10gPSB0YWJsZVNwZWMuc3BsaXQoJzonKTtcclxuICAgICAgICAgIGNvbnN0IHRhYmxlID0gdGFibGVzTWFwLmdldCh0YWJsZU5hbWUpO1xyXG5cclxuICAgICAgICAgIGlmICh0YWJsZSkge1xyXG4gICAgICAgICAgICBpZiAoYWNjZXNzVHlwZSA9PT0gJ3JlYWQnKSB7XHJcbiAgICAgICAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OWIEdyYW50ZWQgUkVBRCBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChhY2Nlc3NUeXBlID09PSAnd3JpdGUnKSB7XHJcbiAgICAgICAgICAgICAgdGFibGUuZ3JhbnRXcml0ZURhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg4pyN77iPICBHcmFudGVkIFdSSVRFIG9uICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OdIEdyYW50ZWQgUkVBRC9XUklURSBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAg4pqg77iPICBUYWJsZSBub3QgZm91bmQ6ICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMi4gUGVybWlzb3MgZGUgUzMgQnVja2V0c1xyXG4gICAgICBpZiAobWV0YWRhdGEuYnVja2V0cyAmJiBtZXRhZGF0YS5idWNrZXRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1Y2tldFNwZWMgb2YgbWV0YWRhdGEuYnVja2V0cykge1xyXG4gICAgICAgICAgLy8gRm9ybWF0bzogXCJidWNrZXROYW1lXCIgbyBcImJ1Y2tldE5hbWU6cmVhZHdyaXRlXCIgbyBcImJ1Y2tldE5hbWU6cmVhZG9ubHlcIlxyXG4gICAgICAgICAgY29uc3QgW2J1Y2tldE5hbWUsIHBlcm1pc3Npb24gPSAncmVhZHdyaXRlJ10gPSBidWNrZXRTcGVjLnNwbGl0KCc6Jyk7XHJcbiAgICAgICAgICBjb25zdCBidWNrZXQgPSBidWNrZXRzTWFwLmdldChidWNrZXROYW1lLnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICAgICAgICAgIGlmIChidWNrZXQpIHtcclxuICAgICAgICAgICAgaWYgKHBlcm1pc3Npb24gPT09ICdyZWFkd3JpdGUnKSB7XHJcbiAgICAgICAgICAgICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk6YgR3JhbnRlZCByZWFkd3JpdGUgYWNjZXNzIHRvIGJ1Y2tldDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBlcm1pc3Npb24gPT09ICdyZWFkb25seScpIHtcclxuICAgICAgICAgICAgICBidWNrZXQuZ3JhbnRSZWFkKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk6YgR3JhbnRlZCByZWFkb25seSBhY2Nlc3MgdG8gYnVja2V0OiAke2J1Y2tldE5hbWV9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIOKaoO+4jyAgQnVja2V0IG5vdCBmb3VuZDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMy4gUG9sw610aWNhcyBhZGljaW9uYWxlcyAoU0VTLCBDb2duaXRvLCBTMywgZXRjKVxyXG4gICAgICBpZiAobWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzICYmIG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBwb2xpY3kgb2YgbWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzKSB7XHJcbiAgICAgICAgICAvLyBTa2lwIHBvbGljaWVzIHdpdGhvdXQgcmVzb3VyY2VzXHJcbiAgICAgICAgICBpZiAoIXBvbGljeS5yZXNvdXJjZXMgfHwgcG9saWN5LnJlc291cmNlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAg4pqg77iPICBTa2lwcGluZyBwb2xpY3kgd2l0aG91dCByZXNvdXJjZXM6ICR7cG9saWN5LmFjdGlvbnM/LmpvaW4oJywgJykgfHwgJ3Vua25vd24nfWApO1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCByZXNvdXJjZXMgPSBwb2xpY3kucmVzb3VyY2VzLm1hcChyID0+IHtcclxuICAgICAgICAgICAgLy8gRXhwYW5kaXIgcmVjdXJzb3MgZXNwZWNpYWxlc1xyXG4gICAgICAgICAgICBpZiAociA9PT0gJ3VzZXJwb29sJykge1xyXG4gICAgICAgICAgICAgIHJldHVybiBgYXJuOmF3czpjb2duaXRvLWlkcDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dXNlcnBvb2wvJHtwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUR9YDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcjtcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgIGFjdGlvbnM6IHBvbGljeS5hY3Rpb25zLFxyXG4gICAgICAgICAgICByZXNvdXJjZXM6IHJlc291cmNlc1xyXG4gICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+UkCBHcmFudGVkIGN1c3RvbSBwb2xpY3k6ICR7cG9saWN5LmFjdGlvbnMuam9pbignLCAnKX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gTEFNQkRBUyBPUFRJTUlaQURBUyAtIFVzYXIgYXBpVXJsIGNvbnN0cnVpZGEgZGluw6FtaWNhbWVudGVcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICAvLyBGcm9udGVuZCBTZXJ2ZXIgTGFtYmRhIC0gU09MTyBQQVJBIERFU0FSUk9MTE8gTE9DQUwgKGRldi1zZXJ2ZXIuanMpXHJcbiAgICAvLyBFbiBwcm9kdWNjacOzbiwgZWwgZnJvbnRlbmQgc2Ugc2lydmUgZGVzZGUgQ2xvdWRGcm9udCArIFMzXHJcbiAgICAvLyBFc3RhIGxhbWJkYSBzZSBtYW50aWVuZSBkZXBsb3lhZGEgcGVybyBOTyBzZSB1c2EgZW4gcHJvZHVjY2nDs25cclxuICAgIC8vIOKaoO+4jyBFTElNSU5BRE86IEZyb250ZW5kIGFob3JhIGVzIFNQQSBzZXJ2aWRhIGRlc2RlIFMzXHJcbiAgICAvLyBAdHMtaWdub3JlIC0gVGVtcG9yYXJ5IGNvbXBhdGliaWxpdHlcclxuICAgIGNvbnN0IGZyb250ZW5kU2VydmVyTGFtYmRhID0gbnVsbCBhcyBhbnk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBUT0RBUyBMQVMgTEFNQkRBUyBBSE9SQSBVU0FOIEFVVE8tRElTQ09WRVJZXHJcbiAgICAvLyBMYXMgbGFtYmRhcyBzZSBkZXNjdWJyZW4gYXV0b23DoXRpY2FtZW50ZSBkZXNkZSBsYSBjYXJwZXRhIGFwaS9cclxuICAgIC8vIHkgc2UgY29uZmlndXJhbiB1c2FuZG8gZWwgbWV0YWRhdGEgZXhwb3J0YWRvIGVuIGNhZGEgYXJjaGl2b1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyDwn4aVIEFVVE8tRElTQ09WRVJZIERFIExBTUJEQVNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc29sZS5sb2coJ1xcbvCfmoAgU3RhcnRpbmcgTGFtYmRhIEF1dG8tRGlzY292ZXJ5Li4uJyk7XHJcblxyXG4gICAgLy8gRGVzY3VicmlyIHRvZGFzIGxhcyBsYW1iZGFzIGVuIC9hcGlcclxuICAgIGNvbnN0IGRpc2NvdmVyZWRMYW1iZGFzID0gZGlzY292ZXJMYW1iZGFzKCcuLi8uLi9hcGknKTtcclxuXHJcbiAgICAvLyBDcmVhciB1biBtYXBhIGRlIGxhbWJkYXMgY3JlYWRhcyBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICBjb25zdCBhdXRvTGFtYmRhcyA9IG5ldyBNYXA8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+KCk7XHJcbiAgICBjb25zdCBhdXRvUm91dGVNYXA6IFJlY29yZDxzdHJpbmcsIGxhbWJkYS5GdW5jdGlvbj4gPSB7fTtcclxuXHJcbiAgICAvLyBQcm9jZXNhciBUT0RBUyBsYXMgbGFtYmRhcyBkaXNjb3ZlcmVkIHF1ZSB0ZW5nYW4gbWV0YWRhdGEgdsOhbGlkYVxyXG4gICAgY29uc3QgbGFtYmRhc1RvQ3JlYXRlID0gZGlzY292ZXJlZExhbWJkYXMuZmlsdGVyKGwgPT4ge1xyXG4gICAgICAvLyBFeGNsdWlyIGxhbWJkYXMgcXVlIGNsYXJhbWVudGUgbm8gc29uIEFQSSBlbmRwb2ludHNcclxuICAgICAgY29uc3QgZXhjbHVkZWQgPSBbJ2hhbmRsZXInLCAnaW5kZXgnLCAnX3RlbXBsYXRlJywgJ3JlcXVpcmVMYXllciddO1xyXG4gICAgICByZXR1cm4gIWV4Y2x1ZGVkLmluY2x1ZGVzKGwubmFtZSkgJiYgbC5tZXRhZGF0YS5yb3V0ZTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKGBcXG7wn5OLIENyZWF0aW5nICR7bGFtYmRhc1RvQ3JlYXRlLmxlbmd0aH0gYXV0by1kaXNjb3ZlcmVkIGxhbWJkYXMuLi5cXG5gKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGRpc2NvdmVyZWQgb2YgbGFtYmRhc1RvQ3JlYXRlKSB7XHJcbiAgICAgIGNvbnN0IHsgbmFtZSwgbWV0YWRhdGEgfSA9IGRpc2NvdmVyZWQ7XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhg8J+UqCBDcmVhdGluZyBsYW1iZGE6ICR7bmFtZX1gKTtcclxuXHJcbiAgICAgIC8vIERldGVybWluYXIgcHJvZmlsZVxyXG4gICAgICBjb25zdCBwcm9maWxlID0gTEFNQkRBX1BST0ZJTEVTW21ldGFkYXRhLnByb2ZpbGUgfHwgJ21lZGl1bSddO1xyXG5cclxuICAgICAgLy8gQ29uc3RydWlyIGVudmlyb25tZW50IHZhcmlhYmxlcyBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICAgIGNvbnN0IGVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIEFQSV9VUkwgc2kgZXMgbmVjZXNhcmlvXHJcbiAgICAgIGVudmlyb25tZW50WydBUElfVVJMJ10gPSBhcGlVcmw7XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIFVTRVJfUE9PTF9JRCBzaSB0aWVuZSBwb2zDrXRpY2FzIGRlIENvZ25pdG9cclxuICAgICAgaWYgKG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcz8uc29tZShwID0+IHAucmVzb3VyY2VzPy5pbmNsdWRlcygndXNlcnBvb2wnKSkpIHtcclxuICAgICAgICBlbnZpcm9ubWVudFsnVVNFUl9QT09MX0lEJ10gPSBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQgfHwgJyc7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFncmVnYXIgU09VUkNFX0VNQUlMIHkgQ09OVEFDVF9FTUFJTCBzaSB0aWVuZSBwb2zDrXRpY2FzIGRlIFNFU1xyXG4gICAgICBpZiAobWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzPy5zb21lKHAgPT4gcC5hY3Rpb25zPy5pbmNsdWRlcygnc2VzOlNlbmRFbWFpbCcpKSkge1xyXG4gICAgICAgIGVudmlyb25tZW50WydTT1VSQ0VfRU1BSUwnXSA9IHByb2Nlc3MuZW52LlNPVVJDRV9FTUFJTCB8fCAnbm9yZXBseUBib3loYXBweS5jbCc7XHJcbiAgICAgICAgZW52aXJvbm1lbnRbJ0NPTlRBQ1RfRU1BSUwnXSA9IHByb2Nlc3MuZW52LkNPTlRBQ1RfRU1BSUwgfHwgJ2FkbWluQGJveWhhcHB5LmNsJztcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWdyZWdhciB2YXJpYWJsZXMgZGUgdGFibGEgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgICBpZiAobWV0YWRhdGEudGFibGVzKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCB0YWJsZVNwZWMgb2YgbWV0YWRhdGEudGFibGVzKSB7XHJcbiAgICAgICAgICBjb25zdCBbZW52S2V5XSA9IHRhYmxlU3BlYy5zcGxpdCgnOicpOyAgLy8gRWo6ICdBR0VOREFfVEFCTEUnXHJcbiAgICAgICAgICBjb25zdCB0YWJsZSA9IHRhYmxlc01hcC5nZXQoZW52S2V5KTtcclxuICAgICAgICAgIGlmICh0YWJsZSkge1xyXG4gICAgICAgICAgICAvLyBEaXJlY3RhbWVudGU6IEFHRU5EQV9UQUJMRSA9ICdBZ2VuZGFGb25vYXVkaW9sb2dpYSdcclxuICAgICAgICAgICAgZW52aXJvbm1lbnRbZW52S2V5XSA9IHRhYmxlLnRhYmxlTmFtZTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPICBUYWJsZSBub3QgZm91bmQgaW4gdGFibGVzTWFwOiAke2VudktleX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAgICAgQXZhaWxhYmxlIGtleXM6ICR7QXJyYXkuZnJvbSh0YWJsZXNNYXAua2V5cygpKS5qb2luKCcsICcpfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWdyZWdhciB2YXJpYWJsZXMgZGUgYnVja2V0IGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgaWYgKG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1Y2tldFNwZWMgb2YgbWV0YWRhdGEuYnVja2V0cykge1xyXG4gICAgICAgICAgY29uc3QgW2J1Y2tldE5hbWVdID0gYnVja2V0U3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c01hcC5nZXQoYnVja2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuICAgICAgICAgIGlmIChidWNrZXQpIHtcclxuICAgICAgICAgICAgLy8gQ29udmVuY2nDs246IElNQUdFU19CVUNLRVQsIE1BVEVSSUFMRVNfQlVDS0VULCBldGMuXHJcbiAgICAgICAgICAgIGNvbnN0IGVudlZhck5hbWUgPSBgJHtidWNrZXROYW1lLnRvVXBwZXJDYXNlKCl9X0JVQ0tFVGA7XHJcbiAgICAgICAgICAgIGVudmlyb25tZW50W2VudlZhck5hbWVdID0gYnVja2V0LmJ1Y2tldE5hbWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBDcmVhciBsYSBsYW1iZGFcclxuICAgICAgY29uc3QgbGFtYmRhRnVuY3Rpb24gPSBjcmVhdGVMYW1iZGEoXHJcbiAgICAgICAgYCR7bmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5hbWUuc2xpY2UoMSl9TGFtYmRhYCxcclxuICAgICAgICBgYXBpLyR7bmFtZX1gLFxyXG4gICAgICAgICdoYW5kbGVyJyxcclxuICAgICAgICBlbnZpcm9ubWVudCxcclxuICAgICAgICBwcm9maWxlXHJcbiAgICAgICk7XHJcblxyXG4gICAgICAvLyBBdXRvLWdyYW50IHBlcm1pc29zXHJcbiAgICAgIGF1dG9HcmFudFBlcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uLCBtZXRhZGF0YSk7XHJcblxyXG4gICAgICAvLyBHdWFyZGFyIGVuIG1hcGFcclxuICAgICAgYXV0b0xhbWJkYXMuc2V0KG5hbWUsIGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgYXV0b1JvdXRlTWFwW21ldGFkYXRhLnJvdXRlXSA9IGxhbWJkYUZ1bmN0aW9uO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pyFICR7bmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHlcXG5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZyhgXFxu4pyFIEF1dG8tZGlzY292ZXJ5IGNvbXBsZXRlISAke2xhbWJkYXNUb0NyZWF0ZS5sZW5ndGh9IGxhbWJkYXMgY3JlYXRlZCBhdXRvbWF0aWNhbGx5XFxuYCk7XHJcbiAgICBjb25zb2xlLmxvZygn8J+TjSBBdXRvLWRpc2NvdmVyZWQgcm91dGVzOicsIE9iamVjdC5rZXlzKGF1dG9Sb3V0ZU1hcCkuam9pbignLCAnKSk7XHJcbiAgICBjb25zb2xlLmxvZygnXFxuJyArICc9Jy5yZXBlYXQoODApICsgJ1xcbicpO1xyXG5cclxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGUgcGFyYSBiYWNrdXBzIGRpYXJpb3MgYSBsYXMgMiBBTSBDaGlsZVxyXG4gICAgY29uc3QgYmFja3VwTGFtYmRhID0gYXV0b0xhbWJkYXMuZ2V0KCdiYWNrdXAnKTtcclxuICAgIGlmIChiYWNrdXBMYW1iZGEpIHtcclxuICAgICAgY29uc3QgYmFja3VwUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQmFja3VwRGlhcmlvUnVsZScsIHtcclxuICAgICAgICBydWxlTmFtZTogJ2JveWhhcHB5LWJhY2t1cC1kaWFyaW8nLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRWplY3V0YSBiYWNrdXAgYXV0b23DoXRpY28gZGlhcmlvIGEgbGFzIDIgQU0nLFxyXG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XHJcbiAgICAgICAgICBtaW51dGU6ICcwJyxcclxuICAgICAgICAgIGhvdXI6ICc2JywgLy8gNiBBTSBVVEMgPSAyIEFNIENoaWxlIChVVEMtNClcclxuICAgICAgICAgIGRheTogJyonLFxyXG4gICAgICAgICAgbW9udGg6ICcqJyxcclxuICAgICAgICAgIHllYXI6ICcqJ1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGVuYWJsZWQ6IHRydWVcclxuICAgICAgfSk7XHJcbiAgICAgIGJhY2t1cFJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGJhY2t1cExhbWJkYSkpO1xyXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJhY2t1cCBkaWFyaW8gY29uZmlndXJhZG8gY29ycmVjdGFtZW50ZVxcbicpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIENPTkZJR1VSQUNJw5NOIERFIFJPVVRJTkcgRU4gQVBJIEdBVEVXQVlcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFVzYXIgU09MTyBsYW1iZGFzIGF1dG8tZGVzY3ViaWVydGFzXHJcbiAgICBjb25zdCByb3V0ZU1hcDogUmVjb3JkPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPiA9IGF1dG9Sb3V0ZU1hcDtcclxuXHJcbiAgICAvLyBMYW1iZGEgUm91dGVyIGNlbnRyYWxpemFkb1xyXG4gICAgY29uc3QgYXBpUm91dGVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBpUm91dGVyTGFtYmRhJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcclxuY29uc3QgeyBMYW1iZGFDbGllbnQsIEludm9rZUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnKTtcclxuY29uc3QgbGFtYmRhQ2xpZW50ID0gbmV3IExhbWJkYUNsaWVudCh7fSk7XHJcblxyXG5jb25zdCBST1VURV9NQVAgPSAke0pTT04uc3RyaW5naWZ5KFxyXG4gIE9iamVjdC5mcm9tRW50cmllcyhcclxuICAgIE9iamVjdC5lbnRyaWVzKHJvdXRlTWFwKS5tYXAoKFtyb3V0ZSwgZm5dKSA9PiBbcm91dGUsIGZuLmZ1bmN0aW9uTmFtZV0pXHJcbiAgKVxyXG4pfTtcclxuXHJcbi8vIFJvdXRlciBMYW1iZGEgLSBVcGRhdGVkOiAyMDI1LTExLTI0VDIyOjAwOjAwWiAtIEZpeCAvYXBpLyBwcmVmaXggaGFuZGxpbmdcclxuZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XHJcblxyXG4gIGxldCBwYXRoID0gZXZlbnQucGF0aCB8fCAnLyc7XHJcbiAgY29uc3Qgb3JpZ2luYWxQYXRoID0gcGF0aDtcclxuXHJcbiAgLy8gRWxpbWluYXIgcHJlZmlqbyAvYXBpLyBzaSBleGlzdGUgKGZyb250ZW5kIHB1ZWRlIGVudmlhciAvYXBpL2NhdGVnb3JpYXMpXHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL2FwaS8nKSkge1xyXG4gICAgcGF0aCA9IHBhdGgucmVwbGFjZSgnL2FwaS8nLCAnLycpO1xyXG4gICAgY29uc29sZS5sb2coJ0NsZWFuZWQgL2FwaS8gcHJlZml4OicsIG9yaWdpbmFsUGF0aCwgJy0+JywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBiYXNlUGF0aCA9ICcvJyArIChwYXRoLnNwbGl0KCcvJylbMV0gfHwgJycpO1xyXG5cclxuICAvLyBCdXNjYXIgbGFtYmRhIHBvciBydXRhIGJhc2VcclxuICBsZXQgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQW2Jhc2VQYXRoXSB8fCBST1VURV9NQVBbcGF0aF07XHJcblxyXG4gIC8vIFJ1dGFzIGVzcGVjaWFsZXMgY29uIHN1Yi1wYXRoc1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9ub3Rhcy9hZ3J1cGFkYXMnKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbm90YXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbm90YXMvcHJvbWVkaW9zJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL25vdGFzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL21hdGVyaWFsZXMvYXByb2JhcicpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9tYXRlcmlhbGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL21hdGVyaWFsZXMvcmVjaGF6YXInKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbWF0ZXJpYWxlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9tYXRlcmlhbGVzL2NvcnJlZ2lyJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL21hdGVyaWFsZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvc2VzaW9uZXMvYXJjaGl2b3MnKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvc2VzaW9uZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvcmVwb3J0ZXMvJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL3JlcG9ydGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL2V4cG9ydGFyLycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9leHBvcnRhciddO1xyXG5cclxuICAvLyDimqDvuI8gRUxJTUlOQURPOiBTdGF0aWMgZmlsZXMgYW5kIGhvbWUgcm91dGluZ1xyXG4gIC8vIEZyb250ZW5kIGlzIG5vdyBzZXJ2ZWQgZnJvbSBTMyBTdGF0aWMgV2Vic2l0ZVxyXG5cclxuICBpZiAoIXRhcmdldExhbWJkYSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogNDA0LFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6ICd0cnVlJ1xyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUm91dGUgbm90IGZvdW5kJywgcGF0aCB9KVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zb2xlLmxvZygnSW52b2tpbmcgbGFtYmRhOicsIHRhcmdldExhbWJkYSwgJ3dpdGggcGF0aDonLCBwYXRoKTtcclxuXHJcbiAgICAvLyBJTVBPUlRBTlRFOiBNb2RpZmljYXIgZWwgZXZlbnQgcGFyYSBxdWUgZWwgcGF0aCBubyB0ZW5nYSAvYXBpL1xyXG4gICAgLy8gTG9zIGxhbWJkYXMgZXNwZXJhbiBydXRhcyBzaW4gZWwgcHJlZmlqbyAvYXBpL1xyXG4gICAgY29uc3QgbW9kaWZpZWRFdmVudCA9IHtcclxuICAgICAgLi4uZXZlbnQsXHJcbiAgICAgIHBhdGg6IHBhdGgsICAvLyBVc2FyIGVsIHBhdGggbGltcGlvIChzaW4gL2FwaS8pXHJcbiAgICAgIHJlc291cmNlOiBwYXRoXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgbGFtYmRhQ2xpZW50LnNlbmQobmV3IEludm9rZUNvbW1hbmQoe1xyXG4gICAgICBGdW5jdGlvbk5hbWU6IHRhcmdldExhbWJkYSxcclxuICAgICAgSW52b2NhdGlvblR5cGU6ICdSZXF1ZXN0UmVzcG9uc2UnLFxyXG4gICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeShtb2RpZmllZEV2ZW50KVxyXG4gICAgfSkpO1xyXG5cclxuICAgIGlmIChyZXNwb25zZS5GdW5jdGlvbkVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0xhbWJkYSBpbnZvY2F0aW9uIGVycm9yOicsIHJlc3BvbnNlLkZ1bmN0aW9uRXJyb3IpO1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdQYXlsb2FkOicsIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5QYXlsb2FkKSk7XHJcblxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IDUwMixcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6ICd0cnVlJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgZXJyb3I6ICdMYW1iZGEgZXhlY3V0aW9uIGVycm9yJyxcclxuICAgICAgICAgIGRldGFpbHM6IHJlc3BvbnNlLkZ1bmN0aW9uRXJyb3IsXHJcbiAgICAgICAgICBwYXlsb2FkOiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuUGF5bG9hZClcclxuICAgICAgICB9KVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UobmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3BvbnNlLlBheWxvYWQpKTtcclxuICAgIGNvbnNvbGUubG9nKCdMYW1iZGEgcmVzcG9uc2Ugc3RhdHVzOicsIHJlc3VsdC5zdGF0dXNDb2RlKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdSb3V0ZXIgZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgY29uc29sZS5lcnJvcignRXJyb3Igc3RhY2s6JywgZXJyb3Iuc3RhY2spO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDUwMCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgcm91dGluZyBlcnJvcicsXHJcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcclxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2tcclxuICAgICAgfSlcclxuICAgIH07XHJcbiAgfVxyXG59O1xyXG4gICAgICBgKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIERhciBwZXJtaXNvcyBhbCByb3V0ZXIgcGFyYSBpbnZvY2FyIHRvZGFzIGxhcyBsYW1iZGFzXHJcbiAgICBPYmplY3QudmFsdWVzKHJvdXRlTWFwKS5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgZm4uZ3JhbnRJbnZva2UoYXBpUm91dGVyTGFtYmRhKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBUEkgR0FURVdBWSBST1VUSU5HXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gTk9UQTogRnJvbnRlbmQgc2Ugc2lydmUgZGVzZGUgUzMgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAoRlJFRSBUSUVSKVxyXG4gICAgLy8gICAgICAgZnJvbnRlbmRTZXJ2ZXJMYW1iZGEgc29sbyBzZSB1c2EgZW4gZGV2LXNlcnZlci5qcyBsb2NhbFxyXG4gICAgLy8gICAgICAgQmFja2VuZCBBUElzIHNlIGFjY2VkZW4gZGlyZWN0YW1lbnRlIHZpYSBBUEkgR2F0ZXdheVxyXG5cclxuICAgIC8vIFByb3h5IHBhcmEgQVBJcyAtIHRvZGFzIGxhcyBydXRhcyB2YW4gYWwgcm91dGVyXHJcbiAgICBjb25zdCBwcm94eSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xyXG4gICAgcHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlSb3V0ZXJMYW1iZGEpKTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBGUkVFIFRJRVI6IE5PIENMT1VERlJPTlRcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIENsb3VkRnJvbnQgc2UgaGEgZWxpbWluYWRvIHBhcmEgbWFudGVuZXJzZSBlbiBlbCBGcmVlIFRpZXJcclxuICAgIC8vIEVsIGZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIFMzIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmdcclxuICAgIC8vIExJTUlUQUNJw5NOOiBTb2xvIEhUVFAgKG5vIEhUVFBTKSBhIG1lbm9zIHF1ZSB1c2VzIENsb3VkRnJvbnQgKGNvc3RvIGV4dHJhKVxyXG4gICAgLy9cclxuICAgIC8vIFBhcmEgaGFiaWxpdGFyIEhUVFBTIGVuIGVsIGZ1dHVybyAoY29uIGNvc3RvKTpcclxuICAgIC8vIDEuIERlc2NvbWVudGFyIGVsIGPDs2RpZ28gZGUgQ2xvdWRGcm9udCBtw6FzIGFiYWpvXHJcbiAgICAvLyAyLiBBY3R1YWxpemFyIGZyb250ZW5kQnVja2V0IHBhcmEgdXNhciBPQUkgZW4gbHVnYXIgZGUgcHVibGljUmVhZEFjY2Vzc1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIE91dHB1dHNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbWFnZXNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogaW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWF0ZXJpYWxlc0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBtYXRlcmlhbGVzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmFja3Vwc0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBiYWNrdXBzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVja2V0IGRlIGJhY2t1cHMgYXV0b23DoXRpY29zIChyZXRlbmNpw7NuIDMwIGTDrWFzKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdCdWNrZXQgUzMgcGFyYSBhcmNoaXZvcyBlc3TDoXRpY29zIGRlbCBmcm9udGVuZCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdCb3lIYXBweUZyb250ZW5kQnVja2V0J1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kV2Vic2l0ZVVSTCcsIHtcclxuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldFdlYnNpdGVVcmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+MkCBVUkwgZGVsIEZyb250ZW5kIChTMyBTdGF0aWMgV2Vic2l0ZSAtIEZSRUUgVElFUikgLSBVU0FSIEVTVEEgVVJMJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0JveUhhcHB5RnJvbnRlbmRVUkwnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVSTCcsIHtcclxuICAgICAgdmFsdWU6IGFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+UlyBVUkwgZGUgQVBJIEdhdGV3YXkgKEJhY2tlbmQgQVBJcyknLFxyXG4gICAgICBleHBvcnROYW1lOiAnQm95SGFwcHlBcGlVUkwnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBOT1RBOiBMb3Mgbm9tYnJlcyBkZSB0YWJsYXMgTk8gc2UgZXhwb3J0YW4gY29tbyBvdXRwdXRzIHBvcnF1ZTpcclxuICAgIC8vIC0gTGFzIGxhbWJkYXMgcmVjaWJlbiBsb3Mgbm9tYnJlcyBhdXRvbcOhdGljYW1lbnRlIHbDrWEgYXV0by1pbnllY2Npw7NuIENES1xyXG4gICAgLy8gLSBObyBoYXkgc2NyaXB0cyBleHRlcm5vcyBxdWUgbmVjZXNpdGVuIGFjY2VkZXIgYSBlc3RvcyB2YWxvcmVzXHJcbiAgICAvLyAtIE1hbnRpZW5lIG91dHB1dHMuanNvbiBzaW1wbGUgeSBzb2xvIGNvbiBpbmZvcm1hY2nDs24gw7p0aWwgcGFyYSBlbCB1c3VhcmlvXHJcbiAgfVxyXG59XHJcbiJdfQ==