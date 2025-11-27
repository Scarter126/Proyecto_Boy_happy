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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
                    // Permite match por key completo o por nombre real
                    let table = tablesMap.get(tableName);
                    // Si no existe, intenta buscar por valor (tableName real)
                    if (!table) {
                        for (const [key, tbl] of tablesMap.entries()) {
                            if (tbl.tableName === tableName) {
                                table = tbl;
                                break;
                            }
                        }
                    }
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
            const lambdaFunction = createLambda(`${name.charAt(0).toUpperCase() + name.slice(1)}Lambda`, `api/${name}`, 'handler', {
                ...environment,
                SOURCE_EMAIL: process.env.SOURCE_EMAIL,
                CONTACT_EMAIL: process.env.CONTACT_EMAIL,
            }, profile);
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
            const userPoolId = process.env.COGNITO_USER_POOL_ID ?? "";
            usuariosLambda.addEnvironment("USER_POOL_ID", userPoolId);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1RUFBeUQ7QUFDekQsK0RBQWlEO0FBQ2pELG1FQUFxRDtBQUNyRCwyREFBNkM7QUFFN0MsdURBQXlDO0FBQ3pDLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsd0VBQTBEO0FBSTFELCtDQUFpQztBQUNqQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUVsQyxvRUFBb0U7QUFDcEUsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLDhCQUE4QixDQUFDLENBQUM7QUE0QjVELDZDQUE2QztBQUM3QyxxQ0FBcUM7QUFDckMsNkNBQTZDO0FBRTdDOzs7R0FHRztBQUNILFNBQVMsZUFBZSxDQUFDLFNBQWlCO0lBQ3hDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRXhELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLFlBQVksRUFBRSxDQUFDLENBQUM7SUFFNUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztRQUNqQyxPQUFPLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ2hFLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDO1NBQ3ZDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMs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NkU7SUFDL0UsQ0FBQztDQUNGO0FBMTRCRCxzQ0EwNEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcclxuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xyXG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcclxuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcclxuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xyXG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcclxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICcuLy5lbnYnIH0pO1xyXG5cclxuLy8gSW1wb3J0YXIgY29uc3RhbnRlcyBkZSBub21icmVzIGRlIHRhYmxhcyAow7puaWNhIGZ1ZW50ZSBkZSB2ZXJkYWQpXHJcbmNvbnN0IFRBQkxFX05BTUVTID0gcmVxdWlyZSgnLi4vLi4vc2hhcmVkL3RhYmxlLW5hbWVzLmNqcycpO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIFRJUE9TIFBBUkEgQVVUTy1ESVNDT1ZFUlkgREUgTEFNQkRBU1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmludGVyZmFjZSBMYW1iZGFNZXRhZGF0YSB7XHJcbiAgcm91dGU6IHN0cmluZztcclxuICBtZXRob2RzPzogc3RyaW5nW107XHJcbiAgYXV0aD86IGJvb2xlYW47XHJcbiAgYXV0aEV4Y2VwdGlvbnM/OiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcclxuICByb2xlcz86IHN0cmluZ1tdO1xyXG4gIHByb2ZpbGU/OiAnbGlnaHQnIHwgJ21lZGl1bScgfCAnaGVhdnknO1xyXG4gIHRhYmxlcz86IHN0cmluZ1tdO1xyXG4gIGJ1Y2tldHM/OiBzdHJpbmdbXTtcclxuICBhZGRpdGlvbmFsUG9saWNpZXM/OiBBcnJheTx7XHJcbiAgICBhY3Rpb25zOiBzdHJpbmdbXTtcclxuICAgIHJlc291cmNlczogc3RyaW5nW107XHJcbiAgfT47XHJcbn1cclxuXHJcbmludGVyZmFjZSBEaXNjb3ZlcmVkTGFtYmRhIHtcclxuICBuYW1lOiBzdHJpbmc7ICAgICAgICAgICAgICAvLyBOb21icmUgZGVsIGFyY2hpdm8gc2luIC5qc1xyXG4gIGZpbGVOYW1lOiBzdHJpbmc7ICAgICAgICAgIC8vIE5vbWJyZSBjb21wbGV0byBkZWwgYXJjaGl2b1xyXG4gIGZpbGVQYXRoOiBzdHJpbmc7ICAgICAgICAgIC8vIFJ1dGEgYWJzb2x1dGEgYWwgYXJjaGl2b1xyXG4gIG1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YTsgIC8vIE1ldGFkYXRhIGV4cG9ydGFkYVxyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gRlVOQ0nDk046IEFVVE8tRElTQ09WRVJZIERFIExBTUJEQVNcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogRGVzY3VicmUgYXV0b23DoXRpY2FtZW50ZSB0b2RhcyBsYXMgbGFtYmRhcyBlbiBlbCBkaXJlY3RvcmlvIGVzcGVjaWZpY2Fkb1xyXG4gKiB5IGV4dHJhZSBzdSBtZXRhZGF0YSBwYXJhIGF1dG8tY29uZmlndXJhY2nDs25cclxuICovXHJcbmZ1bmN0aW9uIGRpc2NvdmVyTGFtYmRhcyhsYW1iZGFEaXI6IHN0cmluZyk6IERpc2NvdmVyZWRMYW1iZGFbXSB7XHJcbiAgY29uc3QgYWJzb2x1dGVQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgbGFtYmRhRGlyKTtcclxuXHJcbiAgY29uc29sZS5sb2coYFxcbvCflI0gRGlzY292ZXJpbmcgbGFtYmRhcyBpbjogJHthYnNvbHV0ZVBhdGh9YCk7XHJcblxyXG4gIGlmICghZnMuZXhpc3RzU3luYyhhYnNvbHV0ZVBhdGgpKSB7XHJcbiAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgTGFtYmRhIGRpcmVjdG9yeSBub3QgZm91bmQ6ICR7YWJzb2x1dGVQYXRofWApO1xyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhhYnNvbHV0ZVBhdGgpXHJcbiAgICAuZmlsdGVyKGYgPT4gZi5lbmRzV2l0aCgnLmpzJykgJiYgIWYuc3RhcnRzV2l0aCgnXycpICYmICFmLnN0YXJ0c1dpdGgoJy4nKSk7XHJcblxyXG4gIGNvbnNvbGUubG9nKGDwn5OmIEZvdW5kICR7ZmlsZXMubGVuZ3RofSBsYW1iZGEgZmlsZXNgKTtcclxuXHJcbiAgY29uc3QgZGlzY292ZXJlZDogRGlzY292ZXJlZExhbWJkYVtdID0gW107XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgY29uc3QgbmFtZSA9IGZpbGUucmVwbGFjZSgnLmpzJywgJycpO1xyXG4gICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4oYWJzb2x1dGVQYXRoLCBmaWxlKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBJbnRlbnRhciBjYXJnYXIgZWwgbcOzZHVsbyBwYXJhIGxlZXIgbWV0YWRhdGFcclxuICAgICAgLy8gTk9UQTogRW4gdGllbXBvIGRlIENESyBzeW50aCwgZXN0byByZXF1aWVyZSBxdWUgbG9zIG3Ds2R1bG9zIHNlYW4gdsOhbGlkb3NcclxuICAgICAgLy8gU2kgaGF5IGVycm9yZXMgZGUgcmVxdWlyZSAoZmFsdGFuIGRlcHMpLCB1c2Ftb3MgbWV0YWRhdGEgcG9yIGRlZmVjdG9cclxuICAgICAgZGVsZXRlIHJlcXVpcmUuY2FjaGVbcmVxdWlyZS5yZXNvbHZlKGZpbGVQYXRoKV07XHJcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHJlcXVpcmUoZmlsZVBhdGgpO1xyXG5cclxuICAgICAgY29uc3QgbWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhID0gbW9kdWxlLm1ldGFkYXRhIHx8IHtcclxuICAgICAgICByb3V0ZTogYC8ke25hbWV9YCxcclxuICAgICAgICBtZXRob2RzOiBbJ0dFVCcsICdQT1NUJ10sXHJcbiAgICAgICAgYXV0aDogdHJ1ZSxcclxuICAgICAgICByb2xlczogWycqJ10sXHJcbiAgICAgICAgcHJvZmlsZTogJ21lZGl1bScsXHJcbiAgICAgICAgdGFibGVzOiBbXVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgZGlzY292ZXJlZC5wdXNoKHtcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIGZpbGVOYW1lOiBmaWxlLFxyXG4gICAgICAgIGZpbGVQYXRoLFxyXG4gICAgICAgIG1ldGFkYXRhXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pyFICR7bmFtZX06ICR7bWV0YWRhdGEucm91dGV9IFske21ldGFkYXRhLnByb2ZpbGV9XSAke21ldGFkYXRhLmF1dGggPyAn8J+UkicgOiAn8J+MkCd9YCk7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zb2xlLndhcm4oYCAg4pqg77iPICBDb3VsZCBub3QgbG9hZCBtZXRhZGF0YSBmb3IgJHtmaWxlfTpgLCBlcnJvci5tZXNzYWdlKTtcclxuXHJcbiAgICAgIC8vIFVzYXIgbWV0YWRhdGEgcG9yIGRlZmVjdG8gc2kgbm8gc2UgcHVlZGUgY2FyZ2FyXHJcbiAgICAgIGNvbnN0IGRlZmF1bHRNZXRhZGF0YTogTGFtYmRhTWV0YWRhdGEgPSB7XHJcbiAgICAgICAgcm91dGU6IGAvJHtuYW1lfWAsXHJcbiAgICAgICAgbWV0aG9kczogWydHRVQnLCAnUE9TVCddLFxyXG4gICAgICAgIGF1dGg6IHRydWUsXHJcbiAgICAgICAgcm9sZXM6IFsnKiddLFxyXG4gICAgICAgIHByb2ZpbGU6ICdtZWRpdW0nLFxyXG4gICAgICAgIHRhYmxlczogW11cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGRpc2NvdmVyZWQucHVzaCh7XHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBmaWxlTmFtZTogZmlsZSxcclxuICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICBtZXRhZGF0YTogZGVmYXVsdE1ldGFkYXRhXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pqg77iPICAke25hbWV9OiBVc2luZyBkZWZhdWx0IG1ldGFkYXRhYCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zb2xlLmxvZyhgXFxu4pyFIERpc2NvdmVyeSBjb21wbGV0ZTogJHtkaXNjb3ZlcmVkLmxlbmd0aH0gbGFtYmRhcyBjb25maWd1cmVkXFxuYCk7XHJcblxyXG4gIHJldHVybiBkaXNjb3ZlcmVkO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQm95SGFwcHlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHJpdmF0ZSB1c3Vhcmlvc0xhbWJkYT86IGxhbWJkYS5GdW5jdGlvbjtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQnVja2V0cyBTM1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgaW1hZ2VzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnSW1hZ2VzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktaW1hZ2VzLSR7dGhpcy5hY2NvdW50fWAsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBjb3JzOiBbe1xyXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcclxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXHJcbiAgICAgICAgZXhwb3NlZEhlYWRlcnM6IFsnRVRhZyddXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBtYXRlcmlhbGVzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTWF0ZXJpYWxlc0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYGJveWhhcHB5LW1hdGVyaWFsZXMtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIGNvcnM6IFt7XHJcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxyXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXVxyXG4gICAgICB9XVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQnVja2V0IHBhcmEgYmFja3VwcyBhdXRvbcOhdGljb3NcclxuICAgIC8vIEZSRUUgVElFUjogU2luIHZlcnNpb25hZG8gcGFyYSBldml0YXIgY29zdG9zIGFkaWNpb25hbGVzXHJcbiAgICBjb25zdCBiYWNrdXBzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQmFja3Vwc0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYGJveWhhcHB5LWJhY2t1cHMtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLCAvLyBSRVRBSU4gcGFyYSBubyBwZXJkZXIgYmFja3Vwc1xyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyBGUkVFIFRJRVI6IERlc2FjdGl2YWRvIHBhcmEgZXZpdGFyIGNvc3Rvc1xyXG4gICAgICBsaWZlY3ljbGVSdWxlczogW3tcclxuICAgICAgICAvLyBSZXRlbmVyIHNvbG8gNyBkw61hcyBkZSBiYWNrdXBzIHBhcmEgbWFudGVuZXJzZSBlbiBGcmVlIFRpZXJcclxuICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg3KVxyXG4gICAgICB9XVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQnVja2V0IHBhcmEgZnJvbnRlbmQgZXN0w6F0aWNvIChIVE1ML0NTUy9KUylcclxuICAgIC8vIEZSRUUgVElFUjogUzMgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAoc2luIENsb3VkRnJvbnQgcGFyYSBldml0YXIgY29zdG9zKVxyXG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYGJveWhhcHB5LWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fWAsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICAvLyBDb25maWd1cmFjacOzbiBwYXJhIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmcgKHDDumJsaWNvKVxyXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLCAvLyBTUEEgZmFsbGJhY2tcclxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSwgLy8gUGVybWl0ZSBhY2Nlc28gcMO6YmxpY28gcGFyYSBTdGF0aWMgV2Vic2l0ZVxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcclxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXHJcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcclxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcclxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlXHJcbiAgICAgIH0pLFxyXG4gICAgICBjb3JzOiBbe1xyXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuSEVBRF0sXHJcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBUQUJMQVMgRFlOQU1PREIgT1BUSU1JWkFEQVNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICAvLyAxLiBUQUJMQSBVU1VBUklPU1xyXG4gICAgLy8gRlJFRSBUSUVSOiBQUk9WSVNJT05FRCBtb2RlIGNvbiA1IFJDVS9XQ1UgKGdyYXRpcyBwZXJtYW5lbnRlbWVudGUpXHJcbiAgICBjb25zdCB1c3Vhcmlvc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc3Vhcmlvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlVTVUFSSU9TX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiA1LCAgLy8gRlJFRSBUSUVSOiAyNSBSQ1UgdG90YWxlcyBjb21wYXJ0aWRhcyBlbnRyZSB0b2RhcyBsYXMgdGFibGFzXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDUsIC8vIEZSRUUgVElFUjogMjUgV0NVIHRvdGFsZXMgY29tcGFydGlkYXMgZW50cmUgdG9kYXMgbGFzIHRhYmxhc1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdXN1YXJpb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VtYWlsSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NvcnJlbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyLiBUQUJMQSBDT01VTklDQUNJT05FUyAoZnVzaW9uYSBBbnVuY2lvcyArIEV2ZW50b3MgKyBNYXRyaWN1bGFzKVxyXG4gICAgY29uc3QgY29tdW5pY2FjaW9uZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29tdW5pY2FjaW9uZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5DT01VTklDQUNJT05FU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgZmlsdHJhciBwb3IgdGlwbyB5IGZlY2hhXHJcbiAgICBjb211bmljYWNpb25lc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0ZlY2hhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBmaWx0cmFyIG1hdHLDrWN1bGFzIHBvciBlc3RhZG9cclxuICAgIGNvbXVuaWNhY2lvbmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFc3RhZG9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXN0YWRvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDMuIFRBQkxBIEFTSVNURU5DSUFcclxuICAgIGNvbnN0IGFzaXN0ZW5jaWFUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXNpc3RlbmNpYVRhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkFTSVNURU5DSUFfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMyxcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGFzaXN0ZW5jaWFUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0N1cnNvRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY3Vyc28nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICBhc2lzdGVuY2lhVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNC4gVEFCTEEgUkVDVVJTT1MgQUNBREVNSUNPUyAoZnVzaW9uYSBOb3RhcyArIE1hdGVyaWFsZXMgKyBCaXTDoWNvcmEgKyBDYXRlZ29yw61hcylcclxuICAgIGNvbnN0IHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdSZWN1cnNvc0FjYWRlbWljb3NUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5SRUNVUlNPU19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMyxcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGNvbnN1bHRhcyBwb3IgYWx1bW5vIChub3RhcylcclxuICAgIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQWx1bW5vSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dEFsdW1ubycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGNvbnN1bHRhcyBwb3IgY3Vyc28geSBhc2lnbmF0dXJhXHJcbiAgICByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0N1cnNvQXNpZ25hdHVyYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjdXJzbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2FzaWduYXR1cmEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgamVyYXJxdcOtYSBkZSBjYXRlZ29yw61hcyAocGFyZW50LWNoaWxkKVxyXG4gICAgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdQYXJlbnRDYXRlZ29yaWFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGFyZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDinIUgR1NJIHBhcmEgYnVzY2FyIHNvbG8gcG9yIElEIChzaW4gdGlwbykgLSBQZXJtaXRlIEdldENvbW1hbmQgY29uIHNvbG8ge2lkfVxyXG4gICAgLy8gTk9UQTogQXVucXVlIHNlIHB1ZWRlIHVzYXIgR2V0Q29tbWFuZCBjb24ge2lkLCB0aXBvfSwgZXN0ZSBHU0kgcGVybWl0ZSBxdWVyaWVzIG3DoXMgZmxleGlibGVzXHJcbiAgICAvLyByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAvLyAgIGluZGV4TmFtZTogJ0lkSW5kZXgnLFxyXG4gICAgLy8gICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgIC8vICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIC8vIH0pO1xyXG4gICAgLy8gQ09NRU5UQURPOiBFbiByZWFsaWRhZCBubyBlcyBuZWNlc2FyaW8gdW4gR1NJIHBhcmEgR2V0Q29tbWFuZC5cclxuICAgIC8vIEdldENvbW1hbmQgZnVuY2lvbmEgY29uIHBhcnRpdGlvbiBrZXkgKyBzb3J0IGtleToge2lkLCB0aXBvfVxyXG4gICAgLy8gRWwgYmFja2VuZCBmdWUgYWN0dWFsaXphZG8gcGFyYSBmdW5jaW9uYXIgYXPDrS5cclxuXHJcbiAgICAvLyA1LiBUQUJMQSBSRVRST0FMSU1FTlRBQ0lPTiAodW5pZmljYSB0b2RhcyBsYXMgb2JzZXJ2YWNpb25lcylcclxuICAgIGNvbnN0IHJldHJvYWxpbWVudGFjaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JldHJvYWxpbWVudGFjaW9uVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuUkVUUk9BTElNRU5UQUNJT05fVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0VXN1YXJpbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBvcmlnZW4geSBmZWNoYVxyXG4gICAgcmV0cm9hbGltZW50YWNpb25UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ09yaWdlbkZlY2hhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yaWdlbicsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDYuIFRBQkxBIEFHRU5EQSBGT05PQVVESU9MT0dJQSAocmVub21icmFkYSlcclxuICAgIGNvbnN0IGFnZW5kYUZvbm9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQWdlbmRhRm9ub1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkFHRU5EQV9UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdmZWNoYUhvcmEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDcuIFRBQkxBIENPTkZJR1VSQUNJT05cclxuICAgIGNvbnN0IGNvbmZpZ3VyYWNpb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29uZmlndXJhY2lvblRhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkNPTkZJR1VSQUNJT05fVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMSxcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDcuNS4gVEFCTEEgTUFURVJJQUxDQVRFR09SSUFTIChSZWxhY2nDs24gTWFueS10by1NYW55KVxyXG4gICAgY29uc3QgbWF0ZXJpYWxDYXRlZ29yaWFzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ01hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLk1BVEVSSUFMX0NBVEVHT1JJQVNfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnbWF0ZXJpYWxJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NhdGVnb3JpYUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCwgLy8gQXV0by1zY2FsaW5nIHBhcmEgbWVqb3IgZXNjYWxhYmlsaWRhZFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIGludmVyc28gcGFyYSBjb25zdWx0YXIgbWF0ZXJpYWxlcyBwb3IgY2F0ZWdvcsOtYVxyXG4gICAgbWF0ZXJpYWxDYXRlZ29yaWFzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdDYXRlZ29yaWFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY2F0ZWdvcmlhSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdtYXRlcmlhbElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDguIFRBQkxBIElORk9STUVTIChOVUVWQSAtIEZBU0UgNSlcclxuICAgIGNvbnN0IGluZm9ybWVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0luZm9ybWVzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogVEFCTEVfTkFNRVMuSU5GT1JNRVNfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGluZm9ybWVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaW5mb3JtZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1RpcG9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA5LiBUQUJMQSBSRVBPUlRFUyAoTlVFVkEgLSBGQVNFIDkpXHJcbiAgICBjb25zdCByZXBvcnRlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdSZXBvcnRlc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLlJFUE9SVEVTX1RBQkxFLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGFHZW5lcmFjaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXBvcnRlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGFHZW5lcmFjaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDEwLiBUQUJMQSBBUE9ERVJBRE9TIChOVUVWQSAtIFJlbGFjaW9uZXMgQXBvZGVyYWRvLUFsdW1ubylcclxuICAgIGNvbnN0IGFwb2RlcmFkb3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXBvZGVyYWRvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkFQT0RFUkFET1NfVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBiw7pzcXVlZGEgcG9yIGNvcnJlb1xyXG4gICAgYXBvZGVyYWRvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRW1haWxJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY29ycmVvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDExLiBUQUJMQSBBUE9ERVJBRE8tQUxVTU5PIChSZWxhY2nDs24gTjpOKVxyXG4gICAgY29uc3QgYXBvZGVyYWRvQWx1bW5vVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0Fwb2RlcmFkb0FsdW1ub1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6IFRBQkxFX05BTUVTLkFQT0RFUkFET19BTFVNTk9fVEFCTEUsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnYXBvZGVyYWRvUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYWx1bW5vUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBxdWVyaWVzIGludmVyc2FzIChidXNjYXIgYXBvZGVyYWRvcyBwb3IgYWx1bW5vKVxyXG4gICAgYXBvZGVyYWRvQWx1bW5vVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnYWx1bW5vUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXBvZGVyYWRvUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDEyLiBUQUJMQSBQUk9GRVNPUi1DVVJTTyAoUmVsYWNpw7NuIDE6TiBjb24gdGlwb3MpXHJcbiAgICBjb25zdCBwcm9mZXNvckN1cnNvVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Byb2Zlc29yQ3Vyc29UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiBUQUJMRV9OQU1FUy5QUk9GRVNPUl9DVVJTT19UQUJMRSxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwcm9mZXNvclJ1dCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2N1cnNvVGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sIC8vIFwiMUEjamVmZVwiIG8gXCIxQSNhc2lnbmF0dXJhI01hdGVtw6F0aWNhc1wiXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgbGlzdGFyIHByb2Zlc29yZXMgZGUgdW4gY3Vyc29cclxuICAgIHByb2Zlc29yQ3Vyc29UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0N1cnNvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBMYW1iZGEgTGF5ZXIgY29uIGRlcGVuZGVuY2lhcyBjb211bmVzXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25EZXBlbmRlbmNpZXNMYXllcicsIHtcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYXllcnMvY29tbW9uJyksXHJcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcclxuICAgICAgZGVzY3JpcHRpb246ICdBV1MgU0RLIHYzICsgdXRpbGlkYWRlcyBjb211bmVzIChyZXNwb25zZSwgbG9nZ2VyLCB2YWxpZGF0aW9uKScsXHJcbiAgICAgIGxheWVyVmVyc2lvbk5hbWU6ICdib3loYXBweS1jb21tb24tZGVwZW5kZW5jaWVzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEhlbHBlciBwYXJhIGNyZWFyIExhbWJkYXMgY29uIGNvbmZpZ3VyYWNpw7NuIG9wdGltaXphZGFcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGludGVyZmFjZSBMYW1iZGFDb25maWcge1xyXG4gICAgICBtZW1vcnk/OiBudW1iZXI7XHJcbiAgICAgIHRpbWVvdXQ/OiBudW1iZXI7XHJcbiAgICAgIGNvbmN1cnJlbmN5PzogbnVtYmVyO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IExBTUJEQV9QUk9GSUxFUyA9IHtcclxuICAgICAgbGlnaHQ6IHsgbWVtb3J5OiAyNTYsIHRpbWVvdXQ6IDEwIH0sICAgIC8vIEF1dGgsIGNhbGxiYWNrc1xyXG4gICAgICBtZWRpdW06IHsgbWVtb3J5OiA1MTIsIHRpbWVvdXQ6IDE1IH0sICAgLy8gQ1JVRCBvcGVyYXRpb25zXHJcbiAgICAgIGhlYXZ5OiB7IG1lbW9yeTogMTAyNCwgdGltZW91dDogMzAgfSwgICAvLyBSZXBvcnRlcywgUzMsIGJhY2t1cHNcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgY3JlYXRlTGFtYmRhID0gKFxyXG4gICAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICAgIGhhbmRsZXJGaWxlOiBzdHJpbmcsXHJcbiAgICAgIGhhbmRsZXJOYW1lOiBzdHJpbmcgPSAnaGFuZGxlcicsXHJcbiAgICAgIGVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30sXHJcbiAgICAgIGNvbmZpZzogTGFtYmRhQ29uZmlnID0gTEFNQkRBX1BST0ZJTEVTLm1lZGl1bVxyXG4gICAgKSA9PiB7XHJcbiAgICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIG5hbWUsIHtcclxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgICBoYW5kbGVyOiBgJHtoYW5kbGVyRmlsZX0uJHtoYW5kbGVyTmFtZX1gLFxyXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4nLCB7XHJcbiAgICAgICAgICBleGNsdWRlOiBbXHJcbiAgICAgICAgICAgICdpbmZyYS8qKicsXHJcbiAgICAgICAgICAgICdmcm9udGVuZC8qKicsXHJcbiAgICAgICAgICAgICdzY3JpcHRzLyoqJyxcclxuICAgICAgICAgICAgJ2Rpc3QvKionLFxyXG4gICAgICAgICAgICAnKi5tZCcsXHJcbiAgICAgICAgICAgICcuZ2l0LyoqJyxcclxuICAgICAgICAgICAgJ25vZGVfbW9kdWxlcy8qKicsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgLi4uZW52aXJvbm1lbnQsXHJcbiAgICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxyXG4gICAgICAgICAgTk9ERV9PUFRJT05TOiAnLS1lbmFibGUtc291cmNlLW1hcHMnLFxyXG4gICAgICAgICAgTEFTVF9ERVBMT1k6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy50aW1lb3V0IHx8IDEwKSxcclxuICAgICAgICBtZW1vcnlTaXplOiBjb25maWcubWVtb3J5IHx8IDM4NCxcclxuICAgICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEFQSSBHQVRFV0FZIC0gQ1JFQVIgUFJJTUVSTyBQQVJBIE9CVEVORVIgTEEgVVJMXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdCb3lIYXBweUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdCb3lIYXBweSBTZXJ2aWNlJyxcclxuICAgICAgZGVwbG95T3B0aW9uczoge1xyXG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICAvLyBDT1JTOiBPcsOtZ2VuZXMgZXNwZWPDrWZpY29zIHBhcmEgZGVzYXJyb2xsbyBsb2NhbCArIHByb2R1Y2Npw7NuIFMzXHJcbiAgICAgICAgLy8gQ1JJVElDQUw6IGFsbG93Q3JlZGVudGlhbHM6IHRydWUgcmVxdWllcmUgb3LDrWdlbmVzIGVzcGVjw61maWNvcyAoTk8gd2lsZGNhcmRzKVxyXG4gICAgICAgIGFsbG93T3JpZ2luczogW1xyXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwNScsICAgICAvLyBGcm9udGVuZCBkZXYgc2VydmVyIChWaXRlIGRlZmF1bHQpXHJcbiAgICAgICAgICAnaHR0cDovLzEyNy4wLjAuMTozMDA1JyxcclxuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLCAgICAgLy8gRmFsbGJhY2sgZGV2IHBvcnRcclxuICAgICAgICAgICdodHRwOi8vMTI3LjAuMC4xOjMwMDAnLFxyXG4gICAgICAgICAgZnJvbnRlbmRCdWNrZXQuYnVja2V0V2Vic2l0ZVVybCAgLy8gUzMgU3RhdGljIFdlYnNpdGUgVVJMIChwcm9kdWNjacOzbilcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxyXG4gICAgICAgICAgJ0Nvb2tpZScsXHJcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXHJcbiAgICAgICAgICAnWC1BcGktS2V5JyxcclxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXHJcbiAgICAgICAgICAnWC1SZXF1ZXN0ZWQtV2l0aCdcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXHJcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24ubWludXRlcygxMClcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbnN0cnVpciBsYSBVUkwgZGVsIEFQSSBHYXRld2F5IG1hbnVhbG1lbnRlIHNpbiBjcmVhciBkZXBlbmRlbmNpYSBjaXJjdWxhclxyXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vJHthcGkucmVzdEFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tL3Byb2RgO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIE1BUEEgREUgVEFCTEFTIFBBUkEgQVVUTy1HUkFOVFxyXG4gICAgLy8gVXNhIGxhcyBDTEFWRVMgZGVsIC5lbnYgY29tbyBrZXlzICjDum5pY2EgZnVlbnRlIGRlIHZlcmRhZClcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IHRhYmxlc01hcCA9IG5ldyBNYXA8c3RyaW5nLCBkeW5hbW9kYi5UYWJsZT4oW1xyXG4gICAgICBbJ1VTVUFSSU9TX1RBQkxFJywgdXN1YXJpb3NUYWJsZV0sXHJcbiAgICAgIFsnQ09NVU5JQ0FDSU9ORVNfVEFCTEUnLCBjb211bmljYWNpb25lc1RhYmxlXSxcclxuICAgICAgWydSRUNVUlNPU19UQUJMRScsIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlXSxcclxuICAgICAgWydBU0lTVEVOQ0lBX1RBQkxFJywgYXNpc3RlbmNpYVRhYmxlXSxcclxuICAgICAgWydBR0VOREFfVEFCTEUnLCBhZ2VuZGFGb25vVGFibGVdLFxyXG4gICAgICBbJ0NPTkZJR1VSQUNJT05fVEFCTEUnLCBjb25maWd1cmFjaW9uVGFibGVdLFxyXG4gICAgICBbJ0lORk9STUVTX1RBQkxFJywgaW5mb3JtZXNUYWJsZV0sXHJcbiAgICAgIFsnUkVQT1JURVNfVEFCTEUnLCByZXBvcnRlc1RhYmxlXSxcclxuICAgICAgWydBUE9ERVJBRE9TX1RBQkxFJywgYXBvZGVyYWRvc1RhYmxlXSxcclxuICAgICAgWydBUE9ERVJBRE9fQUxVTU5PX1RBQkxFJywgYXBvZGVyYWRvQWx1bW5vVGFibGVdLFxyXG4gICAgICBbJ1BST0ZFU09SX0NVUlNPX1RBQkxFJywgcHJvZmVzb3JDdXJzb1RhYmxlXSxcclxuICAgICAgWydSRVRST0FMSU1FTlRBQ0lPTl9UQUJMRScsIHJldHJvYWxpbWVudGFjaW9uVGFibGVdLFxyXG4gICAgICBbJ01BVEVSSUFMX0NBVEVHT1JJQVNfVEFCTEUnLCBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZV1cclxuICAgIF0pO1xyXG5cclxuICAgIGNvbnN0IGJ1Y2tldHNNYXAgPSBuZXcgTWFwPHN0cmluZywgczMuQnVja2V0PihbXHJcbiAgICAgIFsnaW1hZ2VzJywgaW1hZ2VzQnVja2V0XSxcclxuICAgICAgWydtYXRlcmlhbGVzJywgbWF0ZXJpYWxlc0J1Y2tldF0sXHJcbiAgICAgIFsnYmFja3VwcycsIGJhY2t1cHNCdWNrZXRdLFxyXG4gICAgICBbJ2Zyb250ZW5kJywgZnJvbnRlbmRCdWNrZXRdXHJcbiAgICBdKTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBGVU5DScOTTjogQVVUTy1HUkFOVCBQRVJNSVNTSU9OU1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLyoqXHJcbiAgICAgKiBPdG9yZ2EgcGVybWlzb3MgYXV0b23DoXRpY2FtZW50ZSBiYXPDoW5kb3NlIGVuIGxhIG1ldGFkYXRhIGRlIGxhIGxhbWJkYVxyXG4gICAgICovXHJcbiAgICBjb25zdCBhdXRvR3JhbnRQZXJtaXNzaW9ucyA9IChcclxuICAgICAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbixcclxuICAgICAgbWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhXHJcbiAgICApID0+IHtcclxuICAgICAgLy8gMS4gUGVybWlzb3MgZGUgRHluYW1vREIgVGFibGVzXHJcbiAgICAgIGlmIChtZXRhZGF0YS50YWJsZXMgJiYgbWV0YWRhdGEudGFibGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHRhYmxlU3BlYyBvZiBtZXRhZGF0YS50YWJsZXMpIHtcclxuICAgICAgICAgIC8vIEZvcm1hdG86IFwiVGFibGVOYW1lXCIgbyBcIlRhYmxlTmFtZTpyZWFkXCIgbyBcIlRhYmxlTmFtZTp3cml0ZVwiXHJcbiAgICAgICAgICBjb25zdCBbdGFibGVOYW1lLCBhY2Nlc3NUeXBlID0gJ3JlYWR3cml0ZSddID0gdGFibGVTcGVjLnNwbGl0KCc6Jyk7XHJcbiAgICAgICAgICAvLyBQZXJtaXRlIG1hdGNoIHBvciBrZXkgY29tcGxldG8gbyBwb3Igbm9tYnJlIHJlYWxcclxuICAgICAgICAgIGxldCB0YWJsZSA9IHRhYmxlc01hcC5nZXQodGFibGVOYW1lKTtcclxuXHJcbiAgICAgICAgICAvLyBTaSBubyBleGlzdGUsIGludGVudGEgYnVzY2FyIHBvciB2YWxvciAodGFibGVOYW1lIHJlYWwpXHJcbiAgICAgICAgICBpZiAoIXRhYmxlKSB7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdGJsXSBvZiB0YWJsZXNNYXAuZW50cmllcygpKSB7XHJcbiAgICAgICAgICAgICAgaWYgKHRibC50YWJsZU5hbWUgPT09IHRhYmxlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgdGFibGUgPSB0Ymw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBpZiAodGFibGUpIHtcclxuICAgICAgICAgICAgaWYgKGFjY2Vzc1R5cGUgPT09ICdyZWFkJykge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZERhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+TliBHcmFudGVkIFJFQUQgb24gJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWNjZXNzVHlwZSA9PT0gJ3dyaXRlJykge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50V3JpdGVEYXRhKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIOKcje+4jyAgR3JhbnRlZCBXUklURSBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+TnSBHcmFudGVkIFJFQUQvV1JJVEUgb24gJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIOKaoO+4jyAgVGFibGUgbm90IGZvdW5kOiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDIuIFBlcm1pc29zIGRlIFMzIEJ1Y2tldHNcclxuICAgICAgaWYgKG1ldGFkYXRhLmJ1Y2tldHMgJiYgbWV0YWRhdGEuYnVja2V0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBidWNrZXRTcGVjIG9mIG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICAgIC8vIEZvcm1hdG86IFwiYnVja2V0TmFtZVwiIG8gXCJidWNrZXROYW1lOnJlYWR3cml0ZVwiIG8gXCJidWNrZXROYW1lOnJlYWRvbmx5XCJcclxuICAgICAgICAgIGNvbnN0IFtidWNrZXROYW1lLCBwZXJtaXNzaW9uID0gJ3JlYWR3cml0ZSddID0gYnVja2V0U3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c01hcC5nZXQoYnVja2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuXHJcbiAgICAgICAgICBpZiAoYnVja2V0KSB7XHJcbiAgICAgICAgICAgIGlmIChwZXJtaXNzaW9uID09PSAncmVhZHdyaXRlJykge1xyXG4gICAgICAgICAgICAgIGJ1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OmIEdyYW50ZWQgcmVhZHdyaXRlIGFjY2VzcyB0byBidWNrZXQ6ICR7YnVja2V0TmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChwZXJtaXNzaW9uID09PSAncmVhZG9ubHknKSB7XHJcbiAgICAgICAgICAgICAgYnVja2V0LmdyYW50UmVhZChsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OmIEdyYW50ZWQgcmVhZG9ubHkgYWNjZXNzIHRvIGJ1Y2tldDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCAgICDimqDvuI8gIEJ1Y2tldCBub3QgZm91bmQ6ICR7YnVja2V0TmFtZX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDMuIFBvbMOtdGljYXMgYWRpY2lvbmFsZXMgKFNFUywgQ29nbml0bywgUzMsIGV0YylcclxuICAgICAgaWYgKG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcyAmJiBtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgcG9saWN5IG9mIG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcykge1xyXG4gICAgICAgICAgLy8gU2tpcCBwb2xpY2llcyB3aXRob3V0IHJlc291cmNlc1xyXG4gICAgICAgICAgaWYgKCFwb2xpY3kucmVzb3VyY2VzIHx8IHBvbGljeS5yZXNvdXJjZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIOKaoO+4jyAgU2tpcHBpbmcgcG9saWN5IHdpdGhvdXQgcmVzb3VyY2VzOiAke3BvbGljeS5hY3Rpb25zPy5qb2luKCcsICcpIHx8ICd1bmtub3duJ31gKTtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc3QgcmVzb3VyY2VzID0gcG9saWN5LnJlc291cmNlcy5tYXAociA9PiB7XHJcbiAgICAgICAgICAgIC8vIEV4cGFuZGlyIHJlY3Vyc29zIGVzcGVjaWFsZXNcclxuICAgICAgICAgICAgaWYgKHIgPT09ICd1c2VycG9vbCcpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gYGFybjphd3M6Y29nbml0by1pZHA6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnVzZXJwb29sLyR7cHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEfWA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHI7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICBhY3Rpb25zOiBwb2xpY3kuYWN0aW9ucyxcclxuICAgICAgICAgICAgcmVzb3VyY2VzOiByZXNvdXJjZXNcclxuICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCflJAgR3JhbnRlZCBjdXN0b20gcG9saWN5OiAke3BvbGljeS5hY3Rpb25zLmpvaW4oJywgJyl9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIExBTUJEQVMgT1BUSU1JWkFEQVMgLSBVc2FyIGFwaVVybCBjb25zdHJ1aWRhIGRpbsOhbWljYW1lbnRlXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgLy8gRnJvbnRlbmQgU2VydmVyIExhbWJkYSAtIFNPTE8gUEFSQSBERVNBUlJPTExPIExPQ0FMIChkZXYtc2VydmVyLmpzKVxyXG4gICAgLy8gRW4gcHJvZHVjY2nDs24sIGVsIGZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIENsb3VkRnJvbnQgKyBTM1xyXG4gICAgLy8gRXN0YSBsYW1iZGEgc2UgbWFudGllbmUgZGVwbG95YWRhIHBlcm8gTk8gc2UgdXNhIGVuIHByb2R1Y2Npw7NuXHJcbiAgICAvLyDimqDvuI8gRUxJTUlOQURPOiBGcm9udGVuZCBhaG9yYSBlcyBTUEEgc2VydmlkYSBkZXNkZSBTM1xyXG4gICAgLy8gQHRzLWlnbm9yZSAtIFRlbXBvcmFyeSBjb21wYXRpYmlsaXR5XHJcbiAgICBjb25zdCBmcm9udGVuZFNlcnZlckxhbWJkYSA9IG51bGwgYXMgYW55O1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gVE9EQVMgTEFTIExBTUJEQVMgQUhPUkEgVVNBTiBBVVRPLURJU0NPVkVSWVxyXG4gICAgLy8gTGFzIGxhbWJkYXMgc2UgZGVzY3VicmVuIGF1dG9tw6F0aWNhbWVudGUgZGVzZGUgbGEgY2FycGV0YSBhcGkvXHJcbiAgICAvLyB5IHNlIGNvbmZpZ3VyYW4gdXNhbmRvIGVsIG1ldGFkYXRhIGV4cG9ydGFkbyBlbiBjYWRhIGFyY2hpdm9cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8g8J+GlSBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnNvbGUubG9nKCdcXG7wn5qAIFN0YXJ0aW5nIExhbWJkYSBBdXRvLURpc2NvdmVyeS4uLicpO1xyXG5cclxuICAgIC8vIERlc2N1YnJpciB0b2RhcyBsYXMgbGFtYmRhcyBlbiAvYXBpXHJcbiAgICBjb25zdCBkaXNjb3ZlcmVkTGFtYmRhcyA9IGRpc2NvdmVyTGFtYmRhcygnLi4vLi4vYXBpJyk7XHJcblxyXG4gICAgLy8gQ3JlYXIgdW4gbWFwYSBkZSBsYW1iZGFzIGNyZWFkYXMgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgY29uc3QgYXV0b0xhbWJkYXMgPSBuZXcgTWFwPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPigpO1xyXG4gICAgY29uc3QgYXV0b1JvdXRlTWFwOiBSZWNvcmQ8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+ID0ge307XHJcblxyXG4gICAgLy8gUHJvY2VzYXIgVE9EQVMgbGFzIGxhbWJkYXMgZGlzY292ZXJlZCBxdWUgdGVuZ2FuIG1ldGFkYXRhIHbDoWxpZGFcclxuICAgIGNvbnN0IGxhbWJkYXNUb0NyZWF0ZSA9IGRpc2NvdmVyZWRMYW1iZGFzLmZpbHRlcihsID0+IHtcclxuICAgICAgLy8gRXhjbHVpciBsYW1iZGFzIHF1ZSBjbGFyYW1lbnRlIG5vIHNvbiBBUEkgZW5kcG9pbnRzXHJcbiAgICAgIGNvbnN0IGV4Y2x1ZGVkID0gWydoYW5kbGVyJywgJ2luZGV4JywgJ190ZW1wbGF0ZScsICdyZXF1aXJlTGF5ZXInXTtcclxuICAgICAgcmV0dXJuICFleGNsdWRlZC5pbmNsdWRlcyhsLm5hbWUpICYmIGwubWV0YWRhdGEucm91dGU7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhgXFxu8J+TiyBDcmVhdGluZyAke2xhbWJkYXNUb0NyZWF0ZS5sZW5ndGh9IGF1dG8tZGlzY292ZXJlZCBsYW1iZGFzLi4uXFxuYCk7XHJcblxyXG4gICAgZm9yIChjb25zdCBkaXNjb3ZlcmVkIG9mIGxhbWJkYXNUb0NyZWF0ZSkge1xyXG4gICAgICBjb25zdCB7IG5hbWUsIG1ldGFkYXRhIH0gPSBkaXNjb3ZlcmVkO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYPCflKggQ3JlYXRpbmcgbGFtYmRhOiAke25hbWV9YCk7XHJcblxyXG4gICAgICAvLyBEZXRlcm1pbmFyIHByb2ZpbGVcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IExBTUJEQV9QUk9GSUxFU1ttZXRhZGF0YS5wcm9maWxlIHx8ICdtZWRpdW0nXTtcclxuXHJcbiAgICAgIC8vIENvbnN0cnVpciBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgICBjb25zdCBlbnZpcm9ubWVudDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG5cclxuICAgICAgLy8gQWdyZWdhciBBUElfVVJMIHNpIGVzIG5lY2VzYXJpb1xyXG4gICAgICBlbnZpcm9ubWVudFsnQVBJX1VSTCddID0gYXBpVXJsO1xyXG5cclxuICAgICAgLy8gQWdyZWdhciBVU0VSX1BPT0xfSUQgc2kgdGllbmUgcG9sw610aWNhcyBkZSBDb2duaXRvXHJcbiAgICAgIGlmIChtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXM/LnNvbWUocCA9PiBwLnJlc291cmNlcz8uaW5jbHVkZXMoJ3VzZXJwb29sJykpKSB7XHJcbiAgICAgICAgZW52aXJvbm1lbnRbJ1VTRVJfUE9PTF9JRCddID0gcHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEIHx8ICcnO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIFNPVVJDRV9FTUFJTCB5IENPTlRBQ1RfRU1BSUwgc2kgdGllbmUgcG9sw610aWNhcyBkZSBTRVNcclxuICAgICAgaWYgKG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcz8uc29tZShwID0+IHAuYWN0aW9ucz8uaW5jbHVkZXMoJ3NlczpTZW5kRW1haWwnKSkpIHtcclxuICAgICAgICBlbnZpcm9ubWVudFsnU09VUkNFX0VNQUlMJ10gPSBwcm9jZXNzLmVudi5TT1VSQ0VfRU1BSUwgfHwgJ25vcmVwbHlAYm95aGFwcHkuY2wnO1xyXG4gICAgICAgIGVudmlyb25tZW50WydDT05UQUNUX0VNQUlMJ10gPSBwcm9jZXNzLmVudi5DT05UQUNUX0VNQUlMIHx8ICdhZG1pbkBib3loYXBweS5jbCc7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFncmVnYXIgdmFyaWFibGVzIGRlIHRhYmxhIGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgaWYgKG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgIGZvciAoY29uc3QgdGFibGVTcGVjIG9mIG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgICAgY29uc3QgW2VudktleV0gPSB0YWJsZVNwZWMuc3BsaXQoJzonKTsgIC8vIEVqOiAnQUdFTkRBX1RBQkxFJ1xyXG4gICAgICAgICAgY29uc3QgdGFibGUgPSB0YWJsZXNNYXAuZ2V0KGVudktleSk7XHJcbiAgICAgICAgICBpZiAodGFibGUpIHtcclxuICAgICAgICAgICAgLy8gRGlyZWN0YW1lbnRlOiBBR0VOREFfVEFCTEUgPSAnQWdlbmRhRm9ub2F1ZGlvbG9naWEnXHJcbiAgICAgICAgICAgIGVudmlyb25tZW50W2VudktleV0gPSB0YWJsZS50YWJsZU5hbWU7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgVGFibGUgbm90IGZvdW5kIGluIHRhYmxlc01hcDogJHtlbnZLZXl9YCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIEF2YWlsYWJsZSBrZXlzOiAke0FycmF5LmZyb20odGFibGVzTWFwLmtleXMoKSkuam9pbignLCAnKX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFncmVnYXIgdmFyaWFibGVzIGRlIGJ1Y2tldCBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICAgIGlmIChtZXRhZGF0YS5idWNrZXRzKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBidWNrZXRTcGVjIG9mIG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICAgIGNvbnN0IFtidWNrZXROYW1lXSA9IGJ1Y2tldFNwZWMuc3BsaXQoJzonKTtcclxuICAgICAgICAgIGNvbnN0IGJ1Y2tldCA9IGJ1Y2tldHNNYXAuZ2V0KGJ1Y2tldE5hbWUudG9Mb3dlckNhc2UoKSk7XHJcbiAgICAgICAgICBpZiAoYnVja2V0KSB7XHJcbiAgICAgICAgICAgIC8vIENvbnZlbmNpw7NuOiBJTUFHRVNfQlVDS0VULCBNQVRFUklBTEVTX0JVQ0tFVCwgZXRjLlxyXG4gICAgICAgICAgICBjb25zdCBlbnZWYXJOYW1lID0gYCR7YnVja2V0TmFtZS50b1VwcGVyQ2FzZSgpfV9CVUNLRVRgO1xyXG4gICAgICAgICAgICBlbnZpcm9ubWVudFtlbnZWYXJOYW1lXSA9IGJ1Y2tldC5idWNrZXROYW1lO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ3JlYXIgbGEgbGFtYmRhXHJcbiAgICAgIGNvbnN0IGxhbWJkYUZ1bmN0aW9uID0gY3JlYXRlTGFtYmRhKFxyXG4gICAgICAgIGAke25hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpfUxhbWJkYWAsXHJcbiAgICAgICAgYGFwaS8ke25hbWV9YCxcclxuICAgICAgICAnaGFuZGxlcicsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgLi4uZW52aXJvbm1lbnQsXHJcbiAgICAgICAgICBTT1VSQ0VfRU1BSUw6IHByb2Nlc3MuZW52LlNPVVJDRV9FTUFJTCEsXHJcbiAgICAgICAgICBDT05UQUNUX0VNQUlMOiBwcm9jZXNzLmVudi5DT05UQUNUX0VNQUlMISxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHByb2ZpbGVcclxuICAgICAgKTtcclxuXHJcbiAgICAgIC8vIEF1dG8tZ3JhbnQgcGVybWlzb3NcclxuICAgICAgYXV0b0dyYW50UGVybWlzc2lvbnMobGFtYmRhRnVuY3Rpb24sIG1ldGFkYXRhKTtcclxuXHJcbiAgICAgIC8vIEd1YXJkYXIgZW4gbWFwYVxyXG4gICAgICBhdXRvTGFtYmRhcy5zZXQobmFtZSwgbGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICBhdXRvUm91dGVNYXBbbWV0YWRhdGEucm91dGVdID0gbGFtYmRhRnVuY3Rpb247XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhgICDinIUgJHtuYW1lfSBjcmVhdGVkIHN1Y2Nlc3NmdWxseVxcbmApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnNvbGUubG9nKGBcXG7inIUgQXV0by1kaXNjb3ZlcnkgY29tcGxldGUhICR7bGFtYmRhc1RvQ3JlYXRlLmxlbmd0aH0gbGFtYmRhcyBjcmVhdGVkIGF1dG9tYXRpY2FsbHlcXG5gKTtcclxuICAgIGNvbnNvbGUubG9nKCfwn5ONIEF1dG8tZGlzY292ZXJlZCByb3V0ZXM6JywgT2JqZWN0LmtleXMoYXV0b1JvdXRlTWFwKS5qb2luKCcsICcpKTtcclxuICAgIGNvbnNvbGUubG9nKCdcXG4nICsgJz0nLnJlcGVhdCg4MCkgKyAnXFxuJyk7XHJcblxyXG4gICAgLy8gRXZlbnRCcmlkZ2UgUnVsZSBwYXJhIGJhY2t1cHMgZGlhcmlvcyBhIGxhcyAyIEFNIENoaWxlXHJcbiAgICBjb25zdCBiYWNrdXBMYW1iZGEgPSBhdXRvTGFtYmRhcy5nZXQoJ2JhY2t1cCcpO1xyXG4gICAgaWYgKGJhY2t1cExhbWJkYSkge1xyXG4gICAgICBjb25zdCBiYWNrdXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdCYWNrdXBEaWFyaW9SdWxlJywge1xyXG4gICAgICAgIHJ1bGVOYW1lOiAnYm95aGFwcHktYmFja3VwLWRpYXJpbycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdFamVjdXRhIGJhY2t1cCBhdXRvbcOhdGljbyBkaWFyaW8gYSBsYXMgMiBBTScsXHJcbiAgICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcclxuICAgICAgICAgIG1pbnV0ZTogJzAnLFxyXG4gICAgICAgICAgaG91cjogJzYnLCAvLyA2IEFNIFVUQyA9IDIgQU0gQ2hpbGUgKFVUQy00KVxyXG4gICAgICAgICAgZGF5OiAnKicsXHJcbiAgICAgICAgICBtb250aDogJyonLFxyXG4gICAgICAgICAgeWVhcjogJyonXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZW5hYmxlZDogdHJ1ZVxyXG4gICAgICB9KTtcclxuICAgICAgYmFja3VwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYmFja3VwTGFtYmRhKSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQmFja3VwIGRpYXJpbyBjb25maWd1cmFkbyBjb3JyZWN0YW1lbnRlXFxuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdXN1YXJpb3NMYW1iZGEgPSBhdXRvTGFtYmRhcy5nZXQoJ1VzdWFyaW9zTGFtYmRhJyk7XHJcbiAgICBpZiAodXN1YXJpb3NMYW1iZGEpIHtcclxuICAgICAgY29uc3QgdXNlclBvb2xJZCA9IHByb2Nlc3MuZW52LkNPR05JVE9fVVNFUl9QT09MX0lEID8/IFwiXCI7XHJcbiAgICAgIHVzdWFyaW9zTGFtYmRhLmFkZEVudmlyb25tZW50KFwiVVNFUl9QT09MX0lEXCIsIHVzZXJQb29sSWQpO1xyXG4gICAgICBjb25zb2xlLmxvZygnVXNlciBQb29sIElEOicsIHVzZXJQb29sSWQpO1xyXG4gICAgICB1c3Vhcmlvc0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxyXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXAnLFxyXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluUmVtb3ZlVXNlckZyb21Hcm91cCdcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmNvZ25pdG8taWRwOiR7cHJvY2Vzcy5lbnYuQVdTX1JFR0lPTn06JHtwcm9jZXNzLmVudi5BV1NfQUNDT1VOVF9JRH06dXNlcnBvb2wvJHtwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUR9YF1cclxuICAgICAgfSkpO1xyXG4gICAgICBjb25zb2xlLmxvZygn4pyFIENvZ25pdG8gcG9saWN5IGFkZGVkIHRvIFVzdWFyaW9zIExhbWJkYScpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBDT05GSUdVUkFDScOTTiBERSBST1VUSU5HIEVOIEFQSSBHQVRFV0FZXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBVc2FyIFNPTE8gbGFtYmRhcyBhdXRvLWRlc2N1YmllcnRhc1xyXG4gICAgY29uc3Qgcm91dGVNYXA6IFJlY29yZDxzdHJpbmcsIGxhbWJkYS5GdW5jdGlvbj4gPSBhdXRvUm91dGVNYXA7XHJcblxyXG4gICAgLy8gTGFtYmRhIFJvdXRlciBjZW50cmFsaXphZG9cclxuICAgIGNvbnN0IGFwaVJvdXRlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaVJvdXRlckxhbWJkYScsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXHJcbmNvbnN0IHsgTGFtYmRhQ2xpZW50LCBJbnZva2VDb21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9jbGllbnQtbGFtYmRhJyk7XHJcbmNvbnN0IGxhbWJkYUNsaWVudCA9IG5ldyBMYW1iZGFDbGllbnQoe30pO1xyXG5cclxuY29uc3QgUk9VVEVfTUFQID0gJHtKU09OLnN0cmluZ2lmeShcclxuICAgICAgICBPYmplY3QuZnJvbUVudHJpZXMoXHJcbiAgICAgICAgICBPYmplY3QuZW50cmllcyhyb3V0ZU1hcCkubWFwKChbcm91dGUsIGZuXSkgPT4gW3JvdXRlLCBmbi5mdW5jdGlvbk5hbWVdKVxyXG4gICAgICAgIClcclxuICAgICAgKX07XHJcblxyXG4vLyBSb3V0ZXIgTGFtYmRhIC0gVXBkYXRlZDogMjAyNS0xMS0yNFQyMjowMDowMFogLSBGaXggL2FwaS8gcHJlZml4IGhhbmRsaW5nXHJcbmV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xyXG5cclxuICBsZXQgcGF0aCA9IGV2ZW50LnBhdGggfHwgJy8nO1xyXG4gIGNvbnN0IG9yaWdpbmFsUGF0aCA9IHBhdGg7XHJcblxyXG4gIC8vIEVsaW1pbmFyIHByZWZpam8gL2FwaS8gc2kgZXhpc3RlIChmcm9udGVuZCBwdWVkZSBlbnZpYXIgL2FwaS9jYXRlZ29yaWFzKVxyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9hcGkvJykpIHtcclxuICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoJy9hcGkvJywgJy8nKTtcclxuICAgIGNvbnNvbGUubG9nKCdDbGVhbmVkIC9hcGkvIHByZWZpeDonLCBvcmlnaW5hbFBhdGgsICctPicsIHBhdGgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgYmFzZVBhdGggPSAnLycgKyAocGF0aC5zcGxpdCgnLycpWzFdIHx8ICcnKTtcclxuXHJcbiAgLy8gQnVzY2FyIGxhbWJkYSBwb3IgcnV0YSBiYXNlXHJcbiAgbGV0IHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFtiYXNlUGF0aF0gfHwgUk9VVEVfTUFQW3BhdGhdO1xyXG5cclxuICAvLyBSdXRhcyBlc3BlY2lhbGVzIGNvbiBzdWItcGF0aHNcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbm90YXMvYWdydXBhZGFzJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL25vdGFzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL25vdGFzL3Byb21lZGlvcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9ub3RhcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9tYXRlcmlhbGVzL2Fwcm9iYXInKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbWF0ZXJpYWxlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9tYXRlcmlhbGVzL3JlY2hhemFyJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL21hdGVyaWFsZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9jb3JyZWdpcicpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9tYXRlcmlhbGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL3Nlc2lvbmVzL2FyY2hpdm9zJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL3Nlc2lvbmVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL3JlcG9ydGVzLycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9yZXBvcnRlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9leHBvcnRhci8nKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvZXhwb3J0YXInXTtcclxuXHJcbiAgLy8g4pqg77iPIEVMSU1JTkFETzogU3RhdGljIGZpbGVzIGFuZCBob21lIHJvdXRpbmdcclxuICAvLyBGcm9udGVuZCBpcyBub3cgc2VydmVkIGZyb20gUzMgU3RhdGljIFdlYnNpdGVcclxuXHJcbiAgaWYgKCF0YXJnZXRMYW1iZGEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDQwNCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1JvdXRlIG5vdCBmb3VuZCcsIHBhdGggfSlcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICB0cnkge1xyXG4gICAgY29uc29sZS5sb2coJ0ludm9raW5nIGxhbWJkYTonLCB0YXJnZXRMYW1iZGEsICd3aXRoIHBhdGg6JywgcGF0aCk7XHJcblxyXG4gICAgLy8gSU1QT1JUQU5URTogTW9kaWZpY2FyIGVsIGV2ZW50IHBhcmEgcXVlIGVsIHBhdGggbm8gdGVuZ2EgL2FwaS9cclxuICAgIC8vIExvcyBsYW1iZGFzIGVzcGVyYW4gcnV0YXMgc2luIGVsIHByZWZpam8gL2FwaS9cclxuICAgIGNvbnN0IG1vZGlmaWVkRXZlbnQgPSB7XHJcbiAgICAgIC4uLmV2ZW50LFxyXG4gICAgICBwYXRoOiBwYXRoLCAgLy8gVXNhciBlbCBwYXRoIGxpbXBpbyAoc2luIC9hcGkvKVxyXG4gICAgICByZXNvdXJjZTogcGF0aFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGxhbWJkYUNsaWVudC5zZW5kKG5ldyBJbnZva2VDb21tYW5kKHtcclxuICAgICAgRnVuY3Rpb25OYW1lOiB0YXJnZXRMYW1iZGEsXHJcbiAgICAgIEludm9jYXRpb25UeXBlOiAnUmVxdWVzdFJlc3BvbnNlJyxcclxuICAgICAgUGF5bG9hZDogSlNPTi5zdHJpbmdpZnkobW9kaWZpZWRFdmVudClcclxuICAgIH0pKTtcclxuXHJcbiAgICBpZiAocmVzcG9uc2UuRnVuY3Rpb25FcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdMYW1iZGEgaW52b2NhdGlvbiBlcnJvcjonLCByZXNwb25zZS5GdW5jdGlvbkVycm9yKTtcclxuICAgICAgY29uc29sZS5lcnJvcignUGF5bG9hZDonLCBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuUGF5bG9hZCkpO1xyXG5cclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXNDb2RlOiA1MDIsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIGVycm9yOiAnTGFtYmRhIGV4ZWN1dGlvbiBlcnJvcicsXHJcbiAgICAgICAgICBkZXRhaWxzOiByZXNwb25zZS5GdW5jdGlvbkVycm9yLFxyXG4gICAgICAgICAgcGF5bG9hZDogbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3BvbnNlLlBheWxvYWQpXHJcbiAgICAgICAgfSlcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5QYXlsb2FkKSk7XHJcbiAgICBjb25zb2xlLmxvZygnTGFtYmRhIHJlc3BvbnNlIHN0YXR1czonLCByZXN1bHQuc3RhdHVzQ29kZSk7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignUm91dGVyIGVycm9yOicsIGVycm9yKTtcclxuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN0YWNrOicsIGVycm9yLnN0YWNrKTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBlcnJvcjogJ0ludGVybmFsIHJvdXRpbmcgZXJyb3InLFxyXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXHJcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuICAgICAgYCksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEYXIgcGVybWlzb3MgYWwgcm91dGVyIHBhcmEgaW52b2NhciB0b2RhcyBsYXMgbGFtYmRhc1xyXG4gICAgT2JqZWN0LnZhbHVlcyhyb3V0ZU1hcCkuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIGZuLmdyYW50SW52b2tlKGFwaVJvdXRlckxhbWJkYSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQVBJIEdBVEVXQVkgUk9VVElOR1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIE5PVEE6IEZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIFMzIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmcgKEZSRUUgVElFUilcclxuICAgIC8vICAgICAgIGZyb250ZW5kU2VydmVyTGFtYmRhIHNvbG8gc2UgdXNhIGVuIGRldi1zZXJ2ZXIuanMgbG9jYWxcclxuICAgIC8vICAgICAgIEJhY2tlbmQgQVBJcyBzZSBhY2NlZGVuIGRpcmVjdGFtZW50ZSB2aWEgQVBJIEdhdGV3YXlcclxuXHJcbiAgICAvLyBQcm94eSBwYXJhIEFQSXMgLSB0b2RhcyBsYXMgcnV0YXMgdmFuIGFsIHJvdXRlclxyXG4gICAgY29uc3QgcHJveHkgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcclxuICAgIHByb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpUm91dGVyTGFtYmRhKSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gRlJFRSBUSUVSOiBOTyBDTE9VREZST05UXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBDbG91ZEZyb250IHNlIGhhIGVsaW1pbmFkbyBwYXJhIG1hbnRlbmVyc2UgZW4gZWwgRnJlZSBUaWVyXHJcbiAgICAvLyBFbCBmcm9udGVuZCBzZSBzaXJ2ZSBkZXNkZSBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nXHJcbiAgICAvLyBMSU1JVEFDScOTTjogU29sbyBIVFRQIChubyBIVFRQUykgYSBtZW5vcyBxdWUgdXNlcyBDbG91ZEZyb250IChjb3N0byBleHRyYSlcclxuICAgIC8vXHJcbiAgICAvLyBQYXJhIGhhYmlsaXRhciBIVFRQUyBlbiBlbCBmdXR1cm8gKGNvbiBjb3N0byk6XHJcbiAgICAvLyAxLiBEZXNjb21lbnRhciBlbCBjw7NkaWdvIGRlIENsb3VkRnJvbnQgbcOhcyBhYmFqb1xyXG4gICAgLy8gMi4gQWN0dWFsaXphciBmcm9udGVuZEJ1Y2tldCBwYXJhIHVzYXIgT0FJIGVuIGx1Z2FyIGRlIHB1YmxpY1JlYWRBY2Nlc3NcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW1hZ2VzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IGltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01hdGVyaWFsZXNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogbWF0ZXJpYWxlc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JhY2t1cHNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogYmFja3Vwc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0J1Y2tldCBkZSBiYWNrdXBzIGF1dG9tw6F0aWNvcyAocmV0ZW5jacOzbiAzMCBkw61hcyknLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVja2V0IFMzIHBhcmEgYXJjaGl2b3MgZXN0w6F0aWNvcyBkZWwgZnJvbnRlbmQnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQm95SGFwcHlGcm9udGVuZEJ1Y2tldCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFdlYnNpdGVVUkwnLCB7XHJcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ/CfjJAgVVJMIGRlbCBGcm9udGVuZCAoUzMgU3RhdGljIFdlYnNpdGUgLSBGUkVFIFRJRVIpIC0gVVNBUiBFU1RBIFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdCb3lIYXBweUZyb250ZW5kVVJMJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVUkwnLCB7XHJcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ/CflJcgVVJMIGRlIEFQSSBHYXRld2F5IChCYWNrZW5kIEFQSXMpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0JveUhhcHB5QXBpVVJMJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTk9UQTogTG9zIG5vbWJyZXMgZGUgdGFibGFzIE5PIHNlIGV4cG9ydGFuIGNvbW8gb3V0cHV0cyBwb3JxdWU6XHJcbiAgICAvLyAtIExhcyBsYW1iZGFzIHJlY2liZW4gbG9zIG5vbWJyZXMgYXV0b23DoXRpY2FtZW50ZSB2w61hIGF1dG8taW55ZWNjacOzbiBDREtcclxuICAgIC8vIC0gTm8gaGF5IHNjcmlwdHMgZXh0ZXJub3MgcXVlIG5lY2VzaXRlbiBhY2NlZGVyIGEgZXN0b3MgdmFsb3Jlc1xyXG4gICAgLy8gLSBNYW50aWVuZSBvdXRwdXRzLmpzb24gc2ltcGxlIHkgc29sbyBjb24gaW5mb3JtYWNpw7NuIMO6dGlsIHBhcmEgZWwgdXN1YXJpb1xyXG4gIH1cclxufVxyXG4iXX0=