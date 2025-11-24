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
            tableName: 'Usuarios',
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
            tableName: 'Comunicaciones',
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
            tableName: 'Asistencia',
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
            tableName: 'RecursosAcademicos',
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
            tableName: 'Retroalimentacion',
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
            tableName: 'AgendaFonoaudiologia',
            partitionKey: { name: 'fechaHora', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 2,
            writeCapacity: 2,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 7. TABLA CONFIGURACION
        const configuracionTable = new dynamodb.Table(this, 'ConfiguracionTable', {
            tableName: 'Configuracion',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 7.5. TABLA MATERIALCATEGORIAS (Relación Many-to-Many)
        const materialCategoriasTable = new dynamodb.Table(this, 'MaterialCategoriasTable', {
            tableName: 'MaterialCategorias',
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
            tableName: 'Informes',
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
            tableName: 'Reportes',
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
            tableName: 'Apoderados',
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
            tableName: 'ApoderadoAlumno',
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
            tableName: 'ProfesorCurso',
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
        // ----------------------------
        const tablesMap = new Map([
            ['Usuarios', usuariosTable],
            ['Comunicaciones', comunicacionesTable],
            ['RecursosAcademicos', recursosAcademicosTable],
            ['Asistencia', asistenciaTable],
            ['Agenda', agendaFonoTable],
            ['Informes', informesTable],
            ['Reportes', reportesTable],
            ['Apoderados', apoderadosTable],
            ['ApoderadoAlumno', apoderadoAlumnoTable],
            ['ProfesorCurso', profesorCursoTable],
            ['Retroalimentacion', retroalimentacionTable],
            ['MaterialCategorias', materialCategoriasTable]
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
            if (metadata.additionalPolicies?.some(p => p.resources.includes('userpool'))) {
                environment['USER_POOL_ID'] = process.env.USER_POOL_ID || '';
            }
            // Agregar variables de tabla automáticamente
            if (metadata.tables) {
                for (const tableSpec of metadata.tables) {
                    const [tableName] = tableSpec.split(':');
                    const table = tablesMap.get(tableName);
                    if (table) {
                        // Convención: USUARIOS_TABLE, COMUNICACIONES_TABLE, etc.
                        const envVarName = `${tableName.toUpperCase()}_TABLE`;
                        environment[envVarName] = table.tableName;
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

exports.handler = async (event) => {

  let path = event.path || '/';

  // Eliminar prefijo /api/ si existe
  if (path.startsWith('/api/')) {
    path = path.replace('/api/', '/');
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

    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: targetLambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(event)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELDJEQUE2QztBQUU3Qyx1REFBeUM7QUFDekMseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFJMUQsK0NBQWlDO0FBQ2pDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBNEJsQyw2Q0FBNkM7QUFDN0MscUNBQXFDO0FBQ3JDLDZDQUE2QztBQUU3Qzs7O0dBR0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxTQUFpQjtJQUN4QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUV4RCxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBRTVELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7UUFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNoRSxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQztTQUN2QyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJ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LENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVO1lBQy9CLFdBQVcsRUFBRSxtREFBbUQ7U0FDakUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLGdEQUFnRDtZQUM3RCxVQUFVLEVBQUUsd0JBQXdCO1NBQ3JDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0I7WUFDdEMsV0FBVyxFQUFFLHFFQUFxRTtZQUNsRixVQUFVLEVBQUUscUJBQXFCO1NBQ2xDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDLENBQUM7UUFFSCxrRUFBa0U7UUFDbEUsMkVBQTJFO1FBQzNFLGtFQUFrRTtRQUNsRSw2RUFBNkU7SUFDL0UsQ0FBQztDQUNGO0FBdjBCRCxzQ0F1MEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcclxuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xyXG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcclxuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcclxuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xyXG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcclxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICcuLy5lbnYnIH0pO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIFRJUE9TIFBBUkEgQVVUTy1ESVNDT1ZFUlkgREUgTEFNQkRBU1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmludGVyZmFjZSBMYW1iZGFNZXRhZGF0YSB7XHJcbiAgcm91dGU6IHN0cmluZztcclxuICBtZXRob2RzPzogc3RyaW5nW107XHJcbiAgYXV0aD86IGJvb2xlYW47XHJcbiAgYXV0aEV4Y2VwdGlvbnM/OiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcclxuICByb2xlcz86IHN0cmluZ1tdO1xyXG4gIHByb2ZpbGU/OiAnbGlnaHQnIHwgJ21lZGl1bScgfCAnaGVhdnknO1xyXG4gIHRhYmxlcz86IHN0cmluZ1tdO1xyXG4gIGJ1Y2tldHM/OiBzdHJpbmdbXTtcclxuICBhZGRpdGlvbmFsUG9saWNpZXM/OiBBcnJheTx7XHJcbiAgICBhY3Rpb25zOiBzdHJpbmdbXTtcclxuICAgIHJlc291cmNlczogc3RyaW5nW107XHJcbiAgfT47XHJcbn1cclxuXHJcbmludGVyZmFjZSBEaXNjb3ZlcmVkTGFtYmRhIHtcclxuICBuYW1lOiBzdHJpbmc7ICAgICAgICAgICAgICAvLyBOb21icmUgZGVsIGFyY2hpdm8gc2luIC5qc1xyXG4gIGZpbGVOYW1lOiBzdHJpbmc7ICAgICAgICAgIC8vIE5vbWJyZSBjb21wbGV0byBkZWwgYXJjaGl2b1xyXG4gIGZpbGVQYXRoOiBzdHJpbmc7ICAgICAgICAgIC8vIFJ1dGEgYWJzb2x1dGEgYWwgYXJjaGl2b1xyXG4gIG1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YTsgIC8vIE1ldGFkYXRhIGV4cG9ydGFkYVxyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gRlVOQ0nDk046IEFVVE8tRElTQ09WRVJZIERFIExBTUJEQVNcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogRGVzY3VicmUgYXV0b23DoXRpY2FtZW50ZSB0b2RhcyBsYXMgbGFtYmRhcyBlbiBlbCBkaXJlY3RvcmlvIGVzcGVjaWZpY2Fkb1xyXG4gKiB5IGV4dHJhZSBzdSBtZXRhZGF0YSBwYXJhIGF1dG8tY29uZmlndXJhY2nDs25cclxuICovXHJcbmZ1bmN0aW9uIGRpc2NvdmVyTGFtYmRhcyhsYW1iZGFEaXI6IHN0cmluZyk6IERpc2NvdmVyZWRMYW1iZGFbXSB7XHJcbiAgY29uc3QgYWJzb2x1dGVQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgbGFtYmRhRGlyKTtcclxuXHJcbiAgY29uc29sZS5sb2coYFxcbvCflI0gRGlzY292ZXJpbmcgbGFtYmRhcyBpbjogJHthYnNvbHV0ZVBhdGh9YCk7XHJcblxyXG4gIGlmICghZnMuZXhpc3RzU3luYyhhYnNvbHV0ZVBhdGgpKSB7XHJcbiAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgTGFtYmRhIGRpcmVjdG9yeSBub3QgZm91bmQ6ICR7YWJzb2x1dGVQYXRofWApO1xyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhhYnNvbHV0ZVBhdGgpXHJcbiAgICAuZmlsdGVyKGYgPT4gZi5lbmRzV2l0aCgnLmpzJykgJiYgIWYuc3RhcnRzV2l0aCgnXycpICYmICFmLnN0YXJ0c1dpdGgoJy4nKSk7XHJcblxyXG4gIGNvbnNvbGUubG9nKGDwn5OmIEZvdW5kICR7ZmlsZXMubGVuZ3RofSBsYW1iZGEgZmlsZXNgKTtcclxuXHJcbiAgY29uc3QgZGlzY292ZXJlZDogRGlzY292ZXJlZExhbWJkYVtdID0gW107XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgY29uc3QgbmFtZSA9IGZpbGUucmVwbGFjZSgnLmpzJywgJycpO1xyXG4gICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4oYWJzb2x1dGVQYXRoLCBmaWxlKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBJbnRlbnRhciBjYXJnYXIgZWwgbcOzZHVsbyBwYXJhIGxlZXIgbWV0YWRhdGFcclxuICAgICAgLy8gTk9UQTogRW4gdGllbXBvIGRlIENESyBzeW50aCwgZXN0byByZXF1aWVyZSBxdWUgbG9zIG3Ds2R1bG9zIHNlYW4gdsOhbGlkb3NcclxuICAgICAgLy8gU2kgaGF5IGVycm9yZXMgZGUgcmVxdWlyZSAoZmFsdGFuIGRlcHMpLCB1c2Ftb3MgbWV0YWRhdGEgcG9yIGRlZmVjdG9cclxuICAgICAgZGVsZXRlIHJlcXVpcmUuY2FjaGVbcmVxdWlyZS5yZXNvbHZlKGZpbGVQYXRoKV07XHJcbiAgICAgIGNvbnN0IG1vZHVsZSA9IHJlcXVpcmUoZmlsZVBhdGgpO1xyXG5cclxuICAgICAgY29uc3QgbWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhID0gbW9kdWxlLm1ldGFkYXRhIHx8IHtcclxuICAgICAgICByb3V0ZTogYC8ke25hbWV9YCxcclxuICAgICAgICBtZXRob2RzOiBbJ0dFVCcsICdQT1NUJ10sXHJcbiAgICAgICAgYXV0aDogdHJ1ZSxcclxuICAgICAgICByb2xlczogWycqJ10sXHJcbiAgICAgICAgcHJvZmlsZTogJ21lZGl1bScsXHJcbiAgICAgICAgdGFibGVzOiBbXVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgZGlzY292ZXJlZC5wdXNoKHtcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIGZpbGVOYW1lOiBmaWxlLFxyXG4gICAgICAgIGZpbGVQYXRoLFxyXG4gICAgICAgIG1ldGFkYXRhXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pyFICR7bmFtZX06ICR7bWV0YWRhdGEucm91dGV9IFske21ldGFkYXRhLnByb2ZpbGV9XSAke21ldGFkYXRhLmF1dGggPyAn8J+UkicgOiAn8J+MkCd9YCk7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zb2xlLndhcm4oYCAg4pqg77iPICBDb3VsZCBub3QgbG9hZCBtZXRhZGF0YSBmb3IgJHtmaWxlfTpgLCBlcnJvci5tZXNzYWdlKTtcclxuXHJcbiAgICAgIC8vIFVzYXIgbWV0YWRhdGEgcG9yIGRlZmVjdG8gc2kgbm8gc2UgcHVlZGUgY2FyZ2FyXHJcbiAgICAgIGNvbnN0IGRlZmF1bHRNZXRhZGF0YTogTGFtYmRhTWV0YWRhdGEgPSB7XHJcbiAgICAgICAgcm91dGU6IGAvJHtuYW1lfWAsXHJcbiAgICAgICAgbWV0aG9kczogWydHRVQnLCAnUE9TVCddLFxyXG4gICAgICAgIGF1dGg6IHRydWUsXHJcbiAgICAgICAgcm9sZXM6IFsnKiddLFxyXG4gICAgICAgIHByb2ZpbGU6ICdtZWRpdW0nLFxyXG4gICAgICAgIHRhYmxlczogW11cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGRpc2NvdmVyZWQucHVzaCh7XHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBmaWxlTmFtZTogZmlsZSxcclxuICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICBtZXRhZGF0YTogZGVmYXVsdE1ldGFkYXRhXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pqg77iPICAke25hbWV9OiBVc2luZyBkZWZhdWx0IG1ldGFkYXRhYCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zb2xlLmxvZyhgXFxu4pyFIERpc2NvdmVyeSBjb21wbGV0ZTogJHtkaXNjb3ZlcmVkLmxlbmd0aH0gbGFtYmRhcyBjb25maWd1cmVkXFxuYCk7XHJcblxyXG4gIHJldHVybiBkaXNjb3ZlcmVkO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQm95SGFwcHlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQnVja2V0cyBTM1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgaW1hZ2VzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnSW1hZ2VzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktaW1hZ2VzLSR7dGhpcy5hY2NvdW50fWAsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbWF0ZXJpYWxlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ01hdGVyaWFsZXNCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBib3loYXBweS1tYXRlcmlhbGVzLSR7dGhpcy5hY2NvdW50fWAsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBjb3JzOiBbe1xyXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcclxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ11cclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEJ1Y2tldCBwYXJhIGJhY2t1cHMgYXV0b23DoXRpY29zXHJcbiAgICAvLyBGUkVFIFRJRVI6IFNpbiB2ZXJzaW9uYWRvIHBhcmEgZXZpdGFyIGNvc3RvcyBhZGljaW9uYWxlc1xyXG4gICAgY29uc3QgYmFja3Vwc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0JhY2t1cHNCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBib3loYXBweS1iYWNrdXBzLSR7dGhpcy5hY2NvdW50fWAsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiwgLy8gUkVUQUlOIHBhcmEgbm8gcGVyZGVyIGJhY2t1cHNcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSwgLy8gRlJFRSBUSUVSOiBEZXNhY3RpdmFkbyBwYXJhIGV2aXRhciBjb3N0b3NcclxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFt7XHJcbiAgICAgICAgLy8gUmV0ZW5lciBzb2xvIDcgZMOtYXMgZGUgYmFja3VwcyBwYXJhIG1hbnRlbmVyc2UgZW4gRnJlZSBUaWVyXHJcbiAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoNylcclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEJ1Y2tldCBwYXJhIGZyb250ZW5kIGVzdMOhdGljbyAoSFRNTC9DU1MvSlMpXHJcbiAgICAvLyBGUkVFIFRJRVI6IFMzIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmcgKHNpbiBDbG91ZEZyb250IHBhcmEgZXZpdGFyIGNvc3RvcylcclxuICAgIGNvbnN0IGZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBib3loYXBweS1mcm9udGVuZC0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgLy8gQ29uZmlndXJhY2nDs24gcGFyYSBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nIChww7pibGljbylcclxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcclxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJywgLy8gU1BBIGZhbGxiYWNrXHJcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsIC8vIFBlcm1pdGUgYWNjZXNvIHDDumJsaWNvIHBhcmEgU3RhdGljIFdlYnNpdGVcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XHJcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxyXG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXHJcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXHJcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZVxyXG4gICAgICB9KSxcclxuICAgICAgY29yczogW3tcclxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLkhFQURdLFxyXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXVxyXG4gICAgICB9XVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gVEFCTEFTIERZTkFNT0RCIE9QVElNSVpBREFTXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgLy8gMS4gVEFCTEEgVVNVQVJJT1NcclxuICAgIC8vIEZSRUUgVElFUjogUFJPVklTSU9ORUQgbW9kZSBjb24gNSBSQ1UvV0NVIChncmF0aXMgcGVybWFuZW50ZW1lbnRlKVxyXG4gICAgY29uc3QgdXN1YXJpb3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXN1YXJpb3NUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnVXN1YXJpb3MnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiA1LCAgLy8gRlJFRSBUSUVSOiAyNSBSQ1UgdG90YWxlcyBjb21wYXJ0aWRhcyBlbnRyZSB0b2RhcyBsYXMgdGFibGFzXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDUsIC8vIEZSRUUgVElFUjogMjUgV0NVIHRvdGFsZXMgY29tcGFydGlkYXMgZW50cmUgdG9kYXMgbGFzIHRhYmxhc1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdXN1YXJpb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VtYWlsSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NvcnJlbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyLiBUQUJMQSBDT01VTklDQUNJT05FUyAoZnVzaW9uYSBBbnVuY2lvcyArIEV2ZW50b3MgKyBNYXRyaWN1bGFzKVxyXG4gICAgY29uc3QgY29tdW5pY2FjaW9uZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29tdW5pY2FjaW9uZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQ29tdW5pY2FjaW9uZXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBmaWx0cmFyIHBvciB0aXBvIHkgZmVjaGFcclxuICAgIGNvbXVuaWNhY2lvbmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvRmVjaGFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGZpbHRyYXIgbWF0csOtY3VsYXMgcG9yIGVzdGFkb1xyXG4gICAgY29tdW5pY2FjaW9uZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VzdGFkb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlc3RhZG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMy4gVEFCTEEgQVNJU1RFTkNJQVxyXG4gICAgY29uc3QgYXNpc3RlbmNpYVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBc2lzdGVuY2lhVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0FzaXN0ZW5jaWEnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBhc2lzdGVuY2lhVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdDdXJzb0ZlY2hhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgYXNpc3RlbmNpYVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQWx1bW5vSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dEFsdW1ubycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDQuIFRBQkxBIFJFQ1VSU09TIEFDQURFTUlDT1MgKGZ1c2lvbmEgTm90YXMgKyBNYXRlcmlhbGVzICsgQml0w6Fjb3JhICsgQ2F0ZWdvcsOtYXMpXHJcbiAgICBjb25zdCByZWN1cnNvc0FjYWRlbWljb3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVjdXJzb3NBY2FkZW1pY29zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ1JlY3Vyc29zQWNhZGVtaWNvcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBjb25zdWx0YXMgcG9yIGFsdW1ubyAobm90YXMpXHJcbiAgICByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBjb25zdWx0YXMgcG9yIGN1cnNvIHkgYXNpZ25hdHVyYVxyXG4gICAgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdDdXJzb0FzaWduYXR1cmFJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY3Vyc28nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhc2lnbmF0dXJhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGplcmFycXXDrWEgZGUgY2F0ZWdvcsOtYXMgKHBhcmVudC1jaGlsZClcclxuICAgIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnUGFyZW50Q2F0ZWdvcmlhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BhcmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pyFIEdTSSBwYXJhIGJ1c2NhciBzb2xvIHBvciBJRCAoc2luIHRpcG8pIC0gUGVybWl0ZSBHZXRDb21tYW5kIGNvbiBzb2xvIHtpZH1cclxuICAgIC8vIE5PVEE6IEF1bnF1ZSBzZSBwdWVkZSB1c2FyIEdldENvbW1hbmQgY29uIHtpZCwgdGlwb30sIGVzdGUgR1NJIHBlcm1pdGUgcXVlcmllcyBtw6FzIGZsZXhpYmxlc1xyXG4gICAgLy8gcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgLy8gICBpbmRleE5hbWU6ICdJZEluZGV4JyxcclxuICAgIC8vICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAvLyAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICAvLyB9KTtcclxuICAgIC8vIENPTUVOVEFETzogRW4gcmVhbGlkYWQgbm8gZXMgbmVjZXNhcmlvIHVuIEdTSSBwYXJhIEdldENvbW1hbmQuXHJcbiAgICAvLyBHZXRDb21tYW5kIGZ1bmNpb25hIGNvbiBwYXJ0aXRpb24ga2V5ICsgc29ydCBrZXk6IHtpZCwgdGlwb31cclxuICAgIC8vIEVsIGJhY2tlbmQgZnVlIGFjdHVhbGl6YWRvIHBhcmEgZnVuY2lvbmFyIGFzw60uXHJcblxyXG4gICAgLy8gNS4gVEFCTEEgUkVUUk9BTElNRU5UQUNJT04gKHVuaWZpY2EgdG9kYXMgbGFzIG9ic2VydmFjaW9uZXMpXHJcbiAgICBjb25zdCByZXRyb2FsaW1lbnRhY2lvblRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdSZXRyb2FsaW1lbnRhY2lvblRhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdSZXRyb2FsaW1lbnRhY2lvbicsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0VXN1YXJpbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBvcmlnZW4geSBmZWNoYVxyXG4gICAgcmV0cm9hbGltZW50YWNpb25UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ09yaWdlbkZlY2hhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yaWdlbicsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDYuIFRBQkxBIEFHRU5EQSBGT05PQVVESU9MT0dJQSAocmVub21icmFkYSlcclxuICAgIGNvbnN0IGFnZW5kYUZvbm9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQWdlbmRhRm9ub1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBZ2VuZGFGb25vYXVkaW9sb2dpYScsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZmVjaGFIb3JhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA3LiBUQUJMQSBDT05GSUdVUkFDSU9OXHJcbiAgICBjb25zdCBjb25maWd1cmFjaW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NvbmZpZ3VyYWNpb25UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQ29uZmlndXJhY2lvbicsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMSxcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDcuNS4gVEFCTEEgTUFURVJJQUxDQVRFR09SSUFTIChSZWxhY2nDs24gTWFueS10by1NYW55KVxyXG4gICAgY29uc3QgbWF0ZXJpYWxDYXRlZ29yaWFzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ01hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdNYXRlcmlhbENhdGVnb3JpYXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ21hdGVyaWFsSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjYXRlZ29yaWFJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIEF1dG8tc2NhbGluZyBwYXJhIG1lam9yIGVzY2FsYWJpbGlkYWRcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBpbnZlcnNvIHBhcmEgY29uc3VsdGFyIG1hdGVyaWFsZXMgcG9yIGNhdGVnb3LDrWFcclxuICAgIG1hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ2F0ZWdvcmlhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NhdGVnb3JpYUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnbWF0ZXJpYWxJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA4LiBUQUJMQSBJTkZPUk1FUyAoTlVFVkEgLSBGQVNFIDUpXHJcbiAgICBjb25zdCBpbmZvcm1lc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdJbmZvcm1lc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdJbmZvcm1lcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGluZm9ybWVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaW5mb3JtZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1RpcG9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA5LiBUQUJMQSBSRVBPUlRFUyAoTlVFVkEgLSBGQVNFIDkpXHJcbiAgICBjb25zdCByZXBvcnRlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdSZXBvcnRlc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdSZXBvcnRlcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlcG9ydGVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYUdlbmVyYWNpb24nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTAuIFRBQkxBIEFQT0RFUkFET1MgKE5VRVZBIC0gUmVsYWNpb25lcyBBcG9kZXJhZG8tQWx1bW5vKVxyXG4gICAgY29uc3QgYXBvZGVyYWRvc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBcG9kZXJhZG9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0Fwb2RlcmFkb3MnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgYsO6c3F1ZWRhIHBvciBjb3JyZW9cclxuICAgIGFwb2RlcmFkb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VtYWlsSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NvcnJlbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAxMS4gVEFCTEEgQVBPREVSQURPLUFMVU1OTyAoUmVsYWNpw7NuIE46TilcclxuICAgIGNvbnN0IGFwb2RlcmFkb0FsdW1ub1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBcG9kZXJhZG9BbHVtbm9UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQXBvZGVyYWRvQWx1bW5vJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIHF1ZXJpZXMgaW52ZXJzYXMgKGJ1c2NhciBhcG9kZXJhZG9zIHBvciBhbHVtbm8pXHJcbiAgICBhcG9kZXJhZG9BbHVtbm9UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdhbHVtbm9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdhcG9kZXJhZG9SdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTIuIFRBQkxBIFBST0ZFU09SLUNVUlNPIChSZWxhY2nDs24gMTpOIGNvbiB0aXBvcylcclxuICAgIGNvbnN0IHByb2Zlc29yQ3Vyc29UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvZmVzb3JDdXJzb1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdQcm9mZXNvckN1cnNvJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwcm9mZXNvclJ1dCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2N1cnNvVGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sIC8vIFwiMUEjamVmZVwiIG8gXCIxQSNhc2lnbmF0dXJhI01hdGVtw6F0aWNhc1wiXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgbGlzdGFyIHByb2Zlc29yZXMgZGUgdW4gY3Vyc29cclxuICAgIHByb2Zlc29yQ3Vyc29UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0N1cnNvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBMYW1iZGEgTGF5ZXIgY29uIGRlcGVuZGVuY2lhcyBjb211bmVzXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25EZXBlbmRlbmNpZXNMYXllcicsIHtcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYXllcnMvY29tbW9uJyksXHJcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcclxuICAgICAgZGVzY3JpcHRpb246ICdBV1MgU0RLIHYzICsgdXRpbGlkYWRlcyBjb211bmVzIChyZXNwb25zZSwgbG9nZ2VyLCB2YWxpZGF0aW9uKScsXHJcbiAgICAgIGxheWVyVmVyc2lvbk5hbWU6ICdib3loYXBweS1jb21tb24tZGVwZW5kZW5jaWVzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEhlbHBlciBwYXJhIGNyZWFyIExhbWJkYXMgY29uIGNvbmZpZ3VyYWNpw7NuIG9wdGltaXphZGFcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGludGVyZmFjZSBMYW1iZGFDb25maWcge1xyXG4gICAgICBtZW1vcnk/OiBudW1iZXI7XHJcbiAgICAgIHRpbWVvdXQ/OiBudW1iZXI7XHJcbiAgICAgIGNvbmN1cnJlbmN5PzogbnVtYmVyO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IExBTUJEQV9QUk9GSUxFUyA9IHtcclxuICAgICAgbGlnaHQ6IHsgbWVtb3J5OiAyNTYsIHRpbWVvdXQ6IDEwIH0sICAgIC8vIEF1dGgsIGNhbGxiYWNrc1xyXG4gICAgICBtZWRpdW06IHsgbWVtb3J5OiA1MTIsIHRpbWVvdXQ6IDE1IH0sICAgLy8gQ1JVRCBvcGVyYXRpb25zXHJcbiAgICAgIGhlYXZ5OiB7IG1lbW9yeTogMTAyNCwgdGltZW91dDogMzAgfSwgICAvLyBSZXBvcnRlcywgUzMsIGJhY2t1cHNcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgY3JlYXRlTGFtYmRhID0gKFxyXG4gICAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICAgIGhhbmRsZXJGaWxlOiBzdHJpbmcsXHJcbiAgICAgIGhhbmRsZXJOYW1lOiBzdHJpbmcgPSAnaGFuZGxlcicsXHJcbiAgICAgIGVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30sXHJcbiAgICAgIGNvbmZpZzogTGFtYmRhQ29uZmlnID0gTEFNQkRBX1BST0ZJTEVTLm1lZGl1bVxyXG4gICAgKSA9PiB7XHJcbiAgICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIG5hbWUsIHtcclxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgICBoYW5kbGVyOiBgJHtoYW5kbGVyRmlsZX0uJHtoYW5kbGVyTmFtZX1gLFxyXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4nLCB7XHJcbiAgICAgICAgICBleGNsdWRlOiBbXHJcbiAgICAgICAgICAgICdpbmZyYS8qKicsXHJcbiAgICAgICAgICAgICdmcm9udGVuZC8qKicsXHJcbiAgICAgICAgICAgICdzY3JpcHRzLyoqJyxcclxuICAgICAgICAgICAgJ2Rpc3QvKionLFxyXG4gICAgICAgICAgICAnKi5tZCcsXHJcbiAgICAgICAgICAgICcuZ2l0LyoqJyxcclxuICAgICAgICAgICAgJ25vZGVfbW9kdWxlcy8qKicsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgLi4uZW52aXJvbm1lbnQsXHJcbiAgICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxyXG4gICAgICAgICAgTk9ERV9PUFRJT05TOiAnLS1lbmFibGUtc291cmNlLW1hcHMnLFxyXG4gICAgICAgICAgTEFTVF9ERVBMT1k6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy50aW1lb3V0IHx8IDEwKSxcclxuICAgICAgICBtZW1vcnlTaXplOiBjb25maWcubWVtb3J5IHx8IDM4NCxcclxuICAgICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEFQSSBHQVRFV0FZIC0gQ1JFQVIgUFJJTUVSTyBQQVJBIE9CVEVORVIgTEEgVVJMXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdCb3lIYXBweUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdCb3lIYXBweSBTZXJ2aWNlJyxcclxuICAgICAgZGVwbG95T3B0aW9uczoge1xyXG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICAvLyBDT1JTOiBPcsOtZ2VuZXMgZXNwZWPDrWZpY29zIHBhcmEgZGVzYXJyb2xsbyBsb2NhbCArIHByb2R1Y2Npw7NuIFMzXHJcbiAgICAgICAgLy8gQ1JJVElDQUw6IGFsbG93Q3JlZGVudGlhbHM6IHRydWUgcmVxdWllcmUgb3LDrWdlbmVzIGVzcGVjw61maWNvcyAoTk8gd2lsZGNhcmRzKVxyXG4gICAgICAgIGFsbG93T3JpZ2luczogW1xyXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwNScsICAgICAvLyBGcm9udGVuZCBkZXYgc2VydmVyIChWaXRlIGRlZmF1bHQpXHJcbiAgICAgICAgICAnaHR0cDovLzEyNy4wLjAuMTozMDA1JyxcclxuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLCAgICAgLy8gRmFsbGJhY2sgZGV2IHBvcnRcclxuICAgICAgICAgICdodHRwOi8vMTI3LjAuMC4xOjMwMDAnLFxyXG4gICAgICAgICAgZnJvbnRlbmRCdWNrZXQuYnVja2V0V2Vic2l0ZVVybCAgLy8gUzMgU3RhdGljIFdlYnNpdGUgVVJMIChwcm9kdWNjacOzbilcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxyXG4gICAgICAgICAgJ0Nvb2tpZScsXHJcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXHJcbiAgICAgICAgICAnWC1BcGktS2V5JyxcclxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXHJcbiAgICAgICAgICAnWC1SZXF1ZXN0ZWQtV2l0aCdcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXHJcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24ubWludXRlcygxMClcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbnN0cnVpciBsYSBVUkwgZGVsIEFQSSBHYXRld2F5IG1hbnVhbG1lbnRlIHNpbiBjcmVhciBkZXBlbmRlbmNpYSBjaXJjdWxhclxyXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vJHthcGkucmVzdEFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tL3Byb2RgO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIE1BUEEgREUgVEFCTEFTIFBBUkEgQVVUTy1HUkFOVFxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgdGFibGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPihbXHJcbiAgICAgIFsnVXN1YXJpb3MnLCB1c3Vhcmlvc1RhYmxlXSxcclxuICAgICAgWydDb211bmljYWNpb25lcycsIGNvbXVuaWNhY2lvbmVzVGFibGVdLFxyXG4gICAgICBbJ1JlY3Vyc29zQWNhZGVtaWNvcycsIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlXSxcclxuICAgICAgWydBc2lzdGVuY2lhJywgYXNpc3RlbmNpYVRhYmxlXSxcclxuICAgICAgWydBZ2VuZGEnLCBhZ2VuZGFGb25vVGFibGVdLFxyXG4gICAgICBbJ0luZm9ybWVzJywgaW5mb3JtZXNUYWJsZV0sXHJcbiAgICAgIFsnUmVwb3J0ZXMnLCByZXBvcnRlc1RhYmxlXSxcclxuICAgICAgWydBcG9kZXJhZG9zJywgYXBvZGVyYWRvc1RhYmxlXSxcclxuICAgICAgWydBcG9kZXJhZG9BbHVtbm8nLCBhcG9kZXJhZG9BbHVtbm9UYWJsZV0sXHJcbiAgICAgIFsnUHJvZmVzb3JDdXJzbycsIHByb2Zlc29yQ3Vyc29UYWJsZV0sXHJcbiAgICAgIFsnUmV0cm9hbGltZW50YWNpb24nLCByZXRyb2FsaW1lbnRhY2lvblRhYmxlXSxcclxuICAgICAgWydNYXRlcmlhbENhdGVnb3JpYXMnLCBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZV1cclxuICAgIF0pO1xyXG5cclxuICAgIGNvbnN0IGJ1Y2tldHNNYXAgPSBuZXcgTWFwPHN0cmluZywgczMuQnVja2V0PihbXHJcbiAgICAgIFsnaW1hZ2VzJywgaW1hZ2VzQnVja2V0XSxcclxuICAgICAgWydtYXRlcmlhbGVzJywgbWF0ZXJpYWxlc0J1Y2tldF0sXHJcbiAgICAgIFsnYmFja3VwcycsIGJhY2t1cHNCdWNrZXRdLFxyXG4gICAgICBbJ2Zyb250ZW5kJywgZnJvbnRlbmRCdWNrZXRdXHJcbiAgICBdKTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBGVU5DScOTTjogQVVUTy1HUkFOVCBQRVJNSVNTSU9OU1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLyoqXHJcbiAgICAgKiBPdG9yZ2EgcGVybWlzb3MgYXV0b23DoXRpY2FtZW50ZSBiYXPDoW5kb3NlIGVuIGxhIG1ldGFkYXRhIGRlIGxhIGxhbWJkYVxyXG4gICAgICovXHJcbiAgICBjb25zdCBhdXRvR3JhbnRQZXJtaXNzaW9ucyA9IChcclxuICAgICAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbixcclxuICAgICAgbWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhXHJcbiAgICApID0+IHtcclxuICAgICAgLy8gMS4gUGVybWlzb3MgZGUgRHluYW1vREIgVGFibGVzXHJcbiAgICAgIGlmIChtZXRhZGF0YS50YWJsZXMgJiYgbWV0YWRhdGEudGFibGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHRhYmxlU3BlYyBvZiBtZXRhZGF0YS50YWJsZXMpIHtcclxuICAgICAgICAgIC8vIEZvcm1hdG86IFwiVGFibGVOYW1lXCIgbyBcIlRhYmxlTmFtZTpyZWFkXCIgbyBcIlRhYmxlTmFtZTp3cml0ZVwiXHJcbiAgICAgICAgICBjb25zdCBbdGFibGVOYW1lLCBhY2Nlc3NUeXBlID0gJ3JlYWR3cml0ZSddID0gdGFibGVTcGVjLnNwbGl0KCc6Jyk7XHJcbiAgICAgICAgICBjb25zdCB0YWJsZSA9IHRhYmxlc01hcC5nZXQodGFibGVOYW1lKTtcclxuXHJcbiAgICAgICAgICBpZiAodGFibGUpIHtcclxuICAgICAgICAgICAgaWYgKGFjY2Vzc1R5cGUgPT09ICdyZWFkJykge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZERhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+TliBHcmFudGVkIFJFQUQgb24gJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWNjZXNzVHlwZSA9PT0gJ3dyaXRlJykge1xyXG4gICAgICAgICAgICAgIHRhYmxlLmdyYW50V3JpdGVEYXRhKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIOKcje+4jyAgR3JhbnRlZCBXUklURSBvbiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICAg8J+TnSBHcmFudGVkIFJFQUQvV1JJVEUgb24gJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgICAgIOKaoO+4jyAgVGFibGUgbm90IGZvdW5kOiAke3RhYmxlTmFtZX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDIuIFBlcm1pc29zIGRlIFMzIEJ1Y2tldHNcclxuICAgICAgaWYgKG1ldGFkYXRhLmJ1Y2tldHMgJiYgbWV0YWRhdGEuYnVja2V0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBidWNrZXRTcGVjIG9mIG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICAgIC8vIEZvcm1hdG86IFwiYnVja2V0TmFtZVwiIG8gXCJidWNrZXROYW1lOnJlYWR3cml0ZVwiIG8gXCJidWNrZXROYW1lOnJlYWRvbmx5XCJcclxuICAgICAgICAgIGNvbnN0IFtidWNrZXROYW1lLCBwZXJtaXNzaW9uID0gJ3JlYWR3cml0ZSddID0gYnVja2V0U3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c01hcC5nZXQoYnVja2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuXHJcbiAgICAgICAgICBpZiAoYnVja2V0KSB7XHJcbiAgICAgICAgICAgIGlmIChwZXJtaXNzaW9uID09PSAncmVhZHdyaXRlJykge1xyXG4gICAgICAgICAgICAgIGJ1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OmIEdyYW50ZWQgcmVhZHdyaXRlIGFjY2VzcyB0byBidWNrZXQ6ICR7YnVja2V0TmFtZX1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChwZXJtaXNzaW9uID09PSAncmVhZG9ubHknKSB7XHJcbiAgICAgICAgICAgICAgYnVja2V0LmdyYW50UmVhZChsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5OmIEdyYW50ZWQgcmVhZG9ubHkgYWNjZXNzIHRvIGJ1Y2tldDogJHtidWNrZXROYW1lfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCAgICDimqDvuI8gIEJ1Y2tldCBub3QgZm91bmQ6ICR7YnVja2V0TmFtZX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDMuIFBvbMOtdGljYXMgYWRpY2lvbmFsZXMgKFNFUywgQ29nbml0bywgUzMsIGV0YylcclxuICAgICAgaWYgKG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcyAmJiBtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgcG9saWN5IG9mIG1ldGFkYXRhLmFkZGl0aW9uYWxQb2xpY2llcykge1xyXG4gICAgICAgICAgY29uc3QgcmVzb3VyY2VzID0gcG9saWN5LnJlc291cmNlcy5tYXAociA9PiB7XHJcbiAgICAgICAgICAgIC8vIEV4cGFuZGlyIHJlY3Vyc29zIGVzcGVjaWFsZXNcclxuICAgICAgICAgICAgaWYgKHIgPT09ICd1c2VycG9vbCcpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gYGFybjphd3M6Y29nbml0by1pZHA6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnVzZXJwb29sLyR7cHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEfWA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHI7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICBhY3Rpb25zOiBwb2xpY3kuYWN0aW9ucyxcclxuICAgICAgICAgICAgcmVzb3VyY2VzOiByZXNvdXJjZXNcclxuICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCflJAgR3JhbnRlZCBjdXN0b20gcG9saWN5OiAke3BvbGljeS5hY3Rpb25zLmpvaW4oJywgJyl9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIExBTUJEQVMgT1BUSU1JWkFEQVMgLSBVc2FyIGFwaVVybCBjb25zdHJ1aWRhIGRpbsOhbWljYW1lbnRlXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgLy8gRnJvbnRlbmQgU2VydmVyIExhbWJkYSAtIFNPTE8gUEFSQSBERVNBUlJPTExPIExPQ0FMIChkZXYtc2VydmVyLmpzKVxyXG4gICAgLy8gRW4gcHJvZHVjY2nDs24sIGVsIGZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIENsb3VkRnJvbnQgKyBTM1xyXG4gICAgLy8gRXN0YSBsYW1iZGEgc2UgbWFudGllbmUgZGVwbG95YWRhIHBlcm8gTk8gc2UgdXNhIGVuIHByb2R1Y2Npw7NuXHJcbiAgICAvLyDimqDvuI8gRUxJTUlOQURPOiBGcm9udGVuZCBhaG9yYSBlcyBTUEEgc2VydmlkYSBkZXNkZSBTM1xyXG4gICAgLy8gQHRzLWlnbm9yZSAtIFRlbXBvcmFyeSBjb21wYXRpYmlsaXR5XHJcbiAgICBjb25zdCBmcm9udGVuZFNlcnZlckxhbWJkYSA9IG51bGwgYXMgYW55O1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gVE9EQVMgTEFTIExBTUJEQVMgQUhPUkEgVVNBTiBBVVRPLURJU0NPVkVSWVxyXG4gICAgLy8gTGFzIGxhbWJkYXMgc2UgZGVzY3VicmVuIGF1dG9tw6F0aWNhbWVudGUgZGVzZGUgbGEgY2FycGV0YSBhcGkvXHJcbiAgICAvLyB5IHNlIGNvbmZpZ3VyYW4gdXNhbmRvIGVsIG1ldGFkYXRhIGV4cG9ydGFkbyBlbiBjYWRhIGFyY2hpdm9cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8g8J+GlSBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnNvbGUubG9nKCdcXG7wn5qAIFN0YXJ0aW5nIExhbWJkYSBBdXRvLURpc2NvdmVyeS4uLicpO1xyXG5cclxuICAgIC8vIERlc2N1YnJpciB0b2RhcyBsYXMgbGFtYmRhcyBlbiAvYXBpXHJcbiAgICBjb25zdCBkaXNjb3ZlcmVkTGFtYmRhcyA9IGRpc2NvdmVyTGFtYmRhcygnLi4vLi4vYXBpJyk7XHJcblxyXG4gICAgLy8gQ3JlYXIgdW4gbWFwYSBkZSBsYW1iZGFzIGNyZWFkYXMgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgY29uc3QgYXV0b0xhbWJkYXMgPSBuZXcgTWFwPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPigpO1xyXG4gICAgY29uc3QgYXV0b1JvdXRlTWFwOiBSZWNvcmQ8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+ID0ge307XHJcblxyXG4gICAgLy8gUHJvY2VzYXIgVE9EQVMgbGFzIGxhbWJkYXMgZGlzY292ZXJlZCBxdWUgdGVuZ2FuIG1ldGFkYXRhIHbDoWxpZGFcclxuICAgIGNvbnN0IGxhbWJkYXNUb0NyZWF0ZSA9IGRpc2NvdmVyZWRMYW1iZGFzLmZpbHRlcihsID0+IHtcclxuICAgICAgLy8gRXhjbHVpciBsYW1iZGFzIHF1ZSBjbGFyYW1lbnRlIG5vIHNvbiBBUEkgZW5kcG9pbnRzXHJcbiAgICAgIGNvbnN0IGV4Y2x1ZGVkID0gWydoYW5kbGVyJywgJ2luZGV4JywgJ190ZW1wbGF0ZScsICdyZXF1aXJlTGF5ZXInXTtcclxuICAgICAgcmV0dXJuICFleGNsdWRlZC5pbmNsdWRlcyhsLm5hbWUpICYmIGwubWV0YWRhdGEucm91dGU7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhgXFxu8J+TiyBDcmVhdGluZyAke2xhbWJkYXNUb0NyZWF0ZS5sZW5ndGh9IGF1dG8tZGlzY292ZXJlZCBsYW1iZGFzLi4uXFxuYCk7XHJcblxyXG4gICAgZm9yIChjb25zdCBkaXNjb3ZlcmVkIG9mIGxhbWJkYXNUb0NyZWF0ZSkge1xyXG4gICAgICBjb25zdCB7IG5hbWUsIG1ldGFkYXRhIH0gPSBkaXNjb3ZlcmVkO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYPCflKggQ3JlYXRpbmcgbGFtYmRhOiAke25hbWV9YCk7XHJcblxyXG4gICAgICAvLyBEZXRlcm1pbmFyIHByb2ZpbGVcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IExBTUJEQV9QUk9GSUxFU1ttZXRhZGF0YS5wcm9maWxlIHx8ICdtZWRpdW0nXTtcclxuXHJcbiAgICAgIC8vIENvbnN0cnVpciBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXV0b23DoXRpY2FtZW50ZVxyXG4gICAgICBjb25zdCBlbnZpcm9ubWVudDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG5cclxuICAgICAgLy8gQWdyZWdhciBBUElfVVJMIHNpIGVzIG5lY2VzYXJpb1xyXG4gICAgICBlbnZpcm9ubWVudFsnQVBJX1VSTCddID0gYXBpVXJsO1xyXG5cclxuICAgICAgLy8gQWdyZWdhciBVU0VSX1BPT0xfSUQgc2kgdGllbmUgcG9sw610aWNhcyBkZSBDb2duaXRvXHJcbiAgICAgIGlmIChtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXM/LnNvbWUocCA9PiBwLnJlc291cmNlcy5pbmNsdWRlcygndXNlcnBvb2wnKSkpIHtcclxuICAgICAgICBlbnZpcm9ubWVudFsnVVNFUl9QT09MX0lEJ10gPSBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQgfHwgJyc7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFncmVnYXIgdmFyaWFibGVzIGRlIHRhYmxhIGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgaWYgKG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgIGZvciAoY29uc3QgdGFibGVTcGVjIG9mIG1ldGFkYXRhLnRhYmxlcykge1xyXG4gICAgICAgICAgY29uc3QgW3RhYmxlTmFtZV0gPSB0YWJsZVNwZWMuc3BsaXQoJzonKTtcclxuICAgICAgICAgIGNvbnN0IHRhYmxlID0gdGFibGVzTWFwLmdldCh0YWJsZU5hbWUpO1xyXG4gICAgICAgICAgaWYgKHRhYmxlKSB7XHJcbiAgICAgICAgICAgIC8vIENvbnZlbmNpw7NuOiBVU1VBUklPU19UQUJMRSwgQ09NVU5JQ0FDSU9ORVNfVEFCTEUsIGV0Yy5cclxuICAgICAgICAgICAgY29uc3QgZW52VmFyTmFtZSA9IGAke3RhYmxlTmFtZS50b1VwcGVyQ2FzZSgpfV9UQUJMRWA7XHJcbiAgICAgICAgICAgIGVudmlyb25tZW50W2VudlZhck5hbWVdID0gdGFibGUudGFibGVOYW1lO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWdyZWdhciB2YXJpYWJsZXMgZGUgYnVja2V0IGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgaWYgKG1ldGFkYXRhLmJ1Y2tldHMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1Y2tldFNwZWMgb2YgbWV0YWRhdGEuYnVja2V0cykge1xyXG4gICAgICAgICAgY29uc3QgW2J1Y2tldE5hbWVdID0gYnVja2V0U3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c01hcC5nZXQoYnVja2V0TmFtZS50b0xvd2VyQ2FzZSgpKTtcclxuICAgICAgICAgIGlmIChidWNrZXQpIHtcclxuICAgICAgICAgICAgLy8gQ29udmVuY2nDs246IElNQUdFU19CVUNLRVQsIE1BVEVSSUFMRVNfQlVDS0VULCBldGMuXHJcbiAgICAgICAgICAgIGNvbnN0IGVudlZhck5hbWUgPSBgJHtidWNrZXROYW1lLnRvVXBwZXJDYXNlKCl9X0JVQ0tFVGA7XHJcbiAgICAgICAgICAgIGVudmlyb25tZW50W2VudlZhck5hbWVdID0gYnVja2V0LmJ1Y2tldE5hbWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBDcmVhciBsYSBsYW1iZGFcclxuICAgICAgY29uc3QgbGFtYmRhRnVuY3Rpb24gPSBjcmVhdGVMYW1iZGEoXHJcbiAgICAgICAgYCR7bmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5hbWUuc2xpY2UoMSl9TGFtYmRhYCxcclxuICAgICAgICBgYXBpLyR7bmFtZX1gLFxyXG4gICAgICAgICdoYW5kbGVyJyxcclxuICAgICAgICBlbnZpcm9ubWVudCxcclxuICAgICAgICBwcm9maWxlXHJcbiAgICAgICk7XHJcblxyXG4gICAgICAvLyBBdXRvLWdyYW50IHBlcm1pc29zXHJcbiAgICAgIGF1dG9HcmFudFBlcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uLCBtZXRhZGF0YSk7XHJcblxyXG4gICAgICAvLyBHdWFyZGFyIGVuIG1hcGFcclxuICAgICAgYXV0b0xhbWJkYXMuc2V0KG5hbWUsIGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgYXV0b1JvdXRlTWFwW21ldGFkYXRhLnJvdXRlXSA9IGxhbWJkYUZ1bmN0aW9uO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coYCAg4pyFICR7bmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHlcXG5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZyhgXFxu4pyFIEF1dG8tZGlzY292ZXJ5IGNvbXBsZXRlISAke2xhbWJkYXNUb0NyZWF0ZS5sZW5ndGh9IGxhbWJkYXMgY3JlYXRlZCBhdXRvbWF0aWNhbGx5XFxuYCk7XHJcbiAgICBjb25zb2xlLmxvZygn8J+TjSBBdXRvLWRpc2NvdmVyZWQgcm91dGVzOicsIE9iamVjdC5rZXlzKGF1dG9Sb3V0ZU1hcCkuam9pbignLCAnKSk7XHJcbiAgICBjb25zb2xlLmxvZygnXFxuJyArICc9Jy5yZXBlYXQoODApICsgJ1xcbicpO1xyXG5cclxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGUgcGFyYSBiYWNrdXBzIGRpYXJpb3MgYSBsYXMgMiBBTSBDaGlsZVxyXG4gICAgY29uc3QgYmFja3VwTGFtYmRhID0gYXV0b0xhbWJkYXMuZ2V0KCdiYWNrdXAnKTtcclxuICAgIGlmIChiYWNrdXBMYW1iZGEpIHtcclxuICAgICAgY29uc3QgYmFja3VwUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQmFja3VwRGlhcmlvUnVsZScsIHtcclxuICAgICAgICBydWxlTmFtZTogJ2JveWhhcHB5LWJhY2t1cC1kaWFyaW8nLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRWplY3V0YSBiYWNrdXAgYXV0b23DoXRpY28gZGlhcmlvIGEgbGFzIDIgQU0nLFxyXG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XHJcbiAgICAgICAgICBtaW51dGU6ICcwJyxcclxuICAgICAgICAgIGhvdXI6ICc2JywgLy8gNiBBTSBVVEMgPSAyIEFNIENoaWxlIChVVEMtNClcclxuICAgICAgICAgIGRheTogJyonLFxyXG4gICAgICAgICAgbW9udGg6ICcqJyxcclxuICAgICAgICAgIHllYXI6ICcqJ1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGVuYWJsZWQ6IHRydWVcclxuICAgICAgfSk7XHJcbiAgICAgIGJhY2t1cFJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGJhY2t1cExhbWJkYSkpO1xyXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJhY2t1cCBkaWFyaW8gY29uZmlndXJhZG8gY29ycmVjdGFtZW50ZVxcbicpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIENPTkZJR1VSQUNJw5NOIERFIFJPVVRJTkcgRU4gQVBJIEdBVEVXQVlcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFVzYXIgU09MTyBsYW1iZGFzIGF1dG8tZGVzY3ViaWVydGFzXHJcbiAgICBjb25zdCByb3V0ZU1hcDogUmVjb3JkPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPiA9IGF1dG9Sb3V0ZU1hcDtcclxuXHJcbiAgICAvLyBMYW1iZGEgUm91dGVyIGNlbnRyYWxpemFkb1xyXG4gICAgY29uc3QgYXBpUm91dGVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBpUm91dGVyTGFtYmRhJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcclxuY29uc3QgeyBMYW1iZGFDbGllbnQsIEludm9rZUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnKTtcclxuY29uc3QgbGFtYmRhQ2xpZW50ID0gbmV3IExhbWJkYUNsaWVudCh7fSk7XHJcblxyXG5jb25zdCBST1VURV9NQVAgPSAke0pTT04uc3RyaW5naWZ5KFxyXG4gIE9iamVjdC5mcm9tRW50cmllcyhcclxuICAgIE9iamVjdC5lbnRyaWVzKHJvdXRlTWFwKS5tYXAoKFtyb3V0ZSwgZm5dKSA9PiBbcm91dGUsIGZuLmZ1bmN0aW9uTmFtZV0pXHJcbiAgKVxyXG4pfTtcclxuXHJcbmV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xyXG5cclxuICBsZXQgcGF0aCA9IGV2ZW50LnBhdGggfHwgJy8nO1xyXG5cclxuICAvLyBFbGltaW5hciBwcmVmaWpvIC9hcGkvIHNpIGV4aXN0ZVxyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9hcGkvJykpIHtcclxuICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoJy9hcGkvJywgJy8nKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGJhc2VQYXRoID0gJy8nICsgKHBhdGguc3BsaXQoJy8nKVsxXSB8fCAnJyk7XHJcblxyXG4gIC8vIEJ1c2NhciBsYW1iZGEgcG9yIHJ1dGEgYmFzZVxyXG4gIGxldCB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbYmFzZVBhdGhdIHx8IFJPVVRFX01BUFtwYXRoXTtcclxuXHJcbiAgLy8gUnV0YXMgZXNwZWNpYWxlcyBjb24gc3ViLXBhdGhzXHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL25vdGFzL2FncnVwYWRhcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9ub3RhcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9ub3Rhcy9wcm9tZWRpb3MnKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbm90YXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9hcHJvYmFyJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL21hdGVyaWFsZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9yZWNoYXphcicpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9tYXRlcmlhbGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL21hdGVyaWFsZXMvY29ycmVnaXInKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbWF0ZXJpYWxlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9zZXNpb25lcy9hcmNoaXZvcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9zZXNpb25lcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9yZXBvcnRlcy8nKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvcmVwb3J0ZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvZXhwb3J0YXIvJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL2V4cG9ydGFyJ107XHJcblxyXG4gIC8vIOKaoO+4jyBFTElNSU5BRE86IFN0YXRpYyBmaWxlcyBhbmQgaG9tZSByb3V0aW5nXHJcbiAgLy8gRnJvbnRlbmQgaXMgbm93IHNlcnZlZCBmcm9tIFMzIFN0YXRpYyBXZWJzaXRlXHJcblxyXG4gIGlmICghdGFyZ2V0TGFtYmRhKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA0MDQsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdSb3V0ZSBub3QgZm91bmQnLCBwYXRoIH0pXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnNvbGUubG9nKCdJbnZva2luZyBsYW1iZGE6JywgdGFyZ2V0TGFtYmRhLCAnd2l0aCBwYXRoOicsIHBhdGgpO1xyXG5cclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgbGFtYmRhQ2xpZW50LnNlbmQobmV3IEludm9rZUNvbW1hbmQoe1xyXG4gICAgICBGdW5jdGlvbk5hbWU6IHRhcmdldExhbWJkYSxcclxuICAgICAgSW52b2NhdGlvblR5cGU6ICdSZXF1ZXN0UmVzcG9uc2UnLFxyXG4gICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeShldmVudClcclxuICAgIH0pKTtcclxuXHJcbiAgICBpZiAocmVzcG9uc2UuRnVuY3Rpb25FcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdMYW1iZGEgaW52b2NhdGlvbiBlcnJvcjonLCByZXNwb25zZS5GdW5jdGlvbkVycm9yKTtcclxuICAgICAgY29uc29sZS5lcnJvcignUGF5bG9hZDonLCBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuUGF5bG9hZCkpO1xyXG5cclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXNDb2RlOiA1MDIsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIGVycm9yOiAnTGFtYmRhIGV4ZWN1dGlvbiBlcnJvcicsXHJcbiAgICAgICAgICBkZXRhaWxzOiByZXNwb25zZS5GdW5jdGlvbkVycm9yLFxyXG4gICAgICAgICAgcGF5bG9hZDogbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3BvbnNlLlBheWxvYWQpXHJcbiAgICAgICAgfSlcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5QYXlsb2FkKSk7XHJcbiAgICBjb25zb2xlLmxvZygnTGFtYmRhIHJlc3BvbnNlIHN0YXR1czonLCByZXN1bHQuc3RhdHVzQ29kZSk7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignUm91dGVyIGVycm9yOicsIGVycm9yKTtcclxuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN0YWNrOicsIGVycm9yLnN0YWNrKTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBlcnJvcjogJ0ludGVybmFsIHJvdXRpbmcgZXJyb3InLFxyXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXHJcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuICAgICAgYCksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEYXIgcGVybWlzb3MgYWwgcm91dGVyIHBhcmEgaW52b2NhciB0b2RhcyBsYXMgbGFtYmRhc1xyXG4gICAgT2JqZWN0LnZhbHVlcyhyb3V0ZU1hcCkuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIGZuLmdyYW50SW52b2tlKGFwaVJvdXRlckxhbWJkYSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQVBJIEdBVEVXQVkgUk9VVElOR1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIE5PVEE6IEZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIFMzIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmcgKEZSRUUgVElFUilcclxuICAgIC8vICAgICAgIGZyb250ZW5kU2VydmVyTGFtYmRhIHNvbG8gc2UgdXNhIGVuIGRldi1zZXJ2ZXIuanMgbG9jYWxcclxuICAgIC8vICAgICAgIEJhY2tlbmQgQVBJcyBzZSBhY2NlZGVuIGRpcmVjdGFtZW50ZSB2aWEgQVBJIEdhdGV3YXlcclxuXHJcbiAgICAvLyBQcm94eSBwYXJhIEFQSXMgLSB0b2RhcyBsYXMgcnV0YXMgdmFuIGFsIHJvdXRlclxyXG4gICAgY29uc3QgcHJveHkgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcclxuICAgIHByb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpUm91dGVyTGFtYmRhKSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gRlJFRSBUSUVSOiBOTyBDTE9VREZST05UXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBDbG91ZEZyb250IHNlIGhhIGVsaW1pbmFkbyBwYXJhIG1hbnRlbmVyc2UgZW4gZWwgRnJlZSBUaWVyXHJcbiAgICAvLyBFbCBmcm9udGVuZCBzZSBzaXJ2ZSBkZXNkZSBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nXHJcbiAgICAvLyBMSU1JVEFDScOTTjogU29sbyBIVFRQIChubyBIVFRQUykgYSBtZW5vcyBxdWUgdXNlcyBDbG91ZEZyb250IChjb3N0byBleHRyYSlcclxuICAgIC8vXHJcbiAgICAvLyBQYXJhIGhhYmlsaXRhciBIVFRQUyBlbiBlbCBmdXR1cm8gKGNvbiBjb3N0byk6XHJcbiAgICAvLyAxLiBEZXNjb21lbnRhciBlbCBjw7NkaWdvIGRlIENsb3VkRnJvbnQgbcOhcyBhYmFqb1xyXG4gICAgLy8gMi4gQWN0dWFsaXphciBmcm9udGVuZEJ1Y2tldCBwYXJhIHVzYXIgT0FJIGVuIGx1Z2FyIGRlIHB1YmxpY1JlYWRBY2Nlc3NcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW1hZ2VzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IGltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01hdGVyaWFsZXNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogbWF0ZXJpYWxlc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JhY2t1cHNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogYmFja3Vwc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0J1Y2tldCBkZSBiYWNrdXBzIGF1dG9tw6F0aWNvcyAocmV0ZW5jacOzbiAzMCBkw61hcyknLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVja2V0IFMzIHBhcmEgYXJjaGl2b3MgZXN0w6F0aWNvcyBkZWwgZnJvbnRlbmQnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQm95SGFwcHlGcm9udGVuZEJ1Y2tldCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFdlYnNpdGVVUkwnLCB7XHJcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ/CfjJAgVVJMIGRlbCBGcm9udGVuZCAoUzMgU3RhdGljIFdlYnNpdGUgLSBGUkVFIFRJRVIpIC0gVVNBUiBFU1RBIFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdCb3lIYXBweUZyb250ZW5kVVJMJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVUkwnLCB7XHJcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ/CflJcgVVJMIGRlIEFQSSBHYXRld2F5IChCYWNrZW5kIEFQSXMpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0JveUhhcHB5QXBpVVJMJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTk9UQTogTG9zIG5vbWJyZXMgZGUgdGFibGFzIE5PIHNlIGV4cG9ydGFuIGNvbW8gb3V0cHV0cyBwb3JxdWU6XHJcbiAgICAvLyAtIExhcyBsYW1iZGFzIHJlY2liZW4gbG9zIG5vbWJyZXMgYXV0b23DoXRpY2FtZW50ZSB2w61hIGF1dG8taW55ZWNjacOzbiBDREtcclxuICAgIC8vIC0gTm8gaGF5IHNjcmlwdHMgZXh0ZXJub3MgcXVlIG5lY2VzaXRlbiBhY2NlZGVyIGEgZXN0b3MgdmFsb3Jlc1xyXG4gICAgLy8gLSBNYW50aWVuZSBvdXRwdXRzLmpzb24gc2ltcGxlIHkgc29sbyBjb24gaW5mb3JtYWNpw7NuIMO6dGlsIHBhcmEgZWwgdXN1YXJpb1xyXG4gIH1cclxufVxyXG4iXX0=