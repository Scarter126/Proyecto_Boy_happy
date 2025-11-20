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
                // CORS: Permitir todos los orígenes (validación en lambdas mediante authMiddleware)
                // NOTA: CloudFront wildcard (*.cloudfront.net) NO está soportado en API Gateway
                // Para producción, especifica el dominio exacto de CloudFront después del deploy
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
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
            ['AgendaFono', agendaFonoTable],
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
            // 2. Políticas adicionales (SES, Cognito, S3, etc)
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
        new cdk.CfnOutput(this, 'UsuariosTableName', {
            value: usuariosTable.tableName,
            description: 'Nombre de la tabla de Usuarios',
        });
        new cdk.CfnOutput(this, 'ComunicacionesTableName', {
            value: comunicacionesTable.tableName,
            description: 'Nombre de la tabla de Comunicaciones (anuncios+eventos+matriculas)',
        });
        new cdk.CfnOutput(this, 'RecursosAcademicosTableName', {
            value: recursosAcademicosTable.tableName,
            description: 'Nombre de la tabla de Recursos Académicos (notas+materiales+bitácora+categorías)',
        });
        new cdk.CfnOutput(this, 'InformesTableName', {
            value: informesTable.tableName,
            description: 'Nombre de la tabla de Informes Fonoaudiológicos',
        });
        new cdk.CfnOutput(this, 'ReportesTableName', {
            value: reportesTable.tableName,
            description: 'Nombre de la tabla de Reportes Consolidados',
        });
        new cdk.CfnOutput(this, 'ApoderadosTableName', {
            value: apoderadosTable.tableName,
            description: 'Nombre de la tabla de Apoderados',
        });
        new cdk.CfnOutput(this, 'ApoderadoAlumnoTableName', {
            value: apoderadoAlumnoTable.tableName,
            description: 'Nombre de la tabla de relación Apoderado-Alumno',
        });
        new cdk.CfnOutput(this, 'ProfesorCursoTableName', {
            value: profesorCursoTable.tableName,
            description: 'Nombre de la tabla de relación Profesor-Curso',
        });
    }
}
exports.BoyHappyStack = BoyHappyStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm95X2hhcHB5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm95X2hhcHB5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELDJEQUE2QztBQUU3Qyx1REFBeUM7QUFDekMseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFJMUQsK0NBQWlDO0FBQ2pDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBMkJsQyw2Q0FBNkM7QUFDN0MscUNBQXFDO0FBQ3JDLDZDQUE2QztBQUU3Qzs7O0dBR0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxTQUFpQjtJQUN4QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUV4RCxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBRTVELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7UUFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNoRSxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQztTQUN2QyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJ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S0FBSyxFQUFFLGVBQWUsQ0FBQyxTQUFTO1lBQ2hDLFdBQVcsRUFBRSxrQ0FBa0M7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsb0JBQW9CLENBQUMsU0FBUztZQUNyQyxXQUFXLEVBQUUsaURBQWlEO1NBQy9ELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDaEQsS0FBSyxFQUFFLGtCQUFrQixDQUFDLFNBQVM7WUFDbkMsV0FBVyxFQUFFLCtDQUErQztTQUM3RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFuMEJELHNDQW0wQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xyXG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XHJcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xyXG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xyXG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XHJcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5kb3RlbnYuY29uZmlnKHsgcGF0aDogJy4vLmVudicgfSk7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gVElQT1MgUEFSQSBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuaW50ZXJmYWNlIExhbWJkYU1ldGFkYXRhIHtcclxuICByb3V0ZTogc3RyaW5nO1xyXG4gIG1ldGhvZHM/OiBzdHJpbmdbXTtcclxuICBhdXRoPzogYm9vbGVhbjtcclxuICBhdXRoRXhjZXB0aW9ucz86IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xyXG4gIHJvbGVzPzogc3RyaW5nW107XHJcbiAgcHJvZmlsZT86ICdsaWdodCcgfCAnbWVkaXVtJyB8ICdoZWF2eSc7XHJcbiAgdGFibGVzPzogc3RyaW5nW107XHJcbiAgYWRkaXRpb25hbFBvbGljaWVzPzogQXJyYXk8e1xyXG4gICAgYWN0aW9uczogc3RyaW5nW107XHJcbiAgICByZXNvdXJjZXM6IHN0cmluZ1tdO1xyXG4gIH0+O1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRGlzY292ZXJlZExhbWJkYSB7XHJcbiAgbmFtZTogc3RyaW5nOyAgICAgICAgICAgICAgLy8gTm9tYnJlIGRlbCBhcmNoaXZvIHNpbiAuanNcclxuICBmaWxlTmFtZTogc3RyaW5nOyAgICAgICAgICAvLyBOb21icmUgY29tcGxldG8gZGVsIGFyY2hpdm9cclxuICBmaWxlUGF0aDogc3RyaW5nOyAgICAgICAgICAvLyBSdXRhIGFic29sdXRhIGFsIGFyY2hpdm9cclxuICBtZXRhZGF0YTogTGFtYmRhTWV0YWRhdGE7ICAvLyBNZXRhZGF0YSBleHBvcnRhZGFcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIEZVTkNJw5NOOiBBVVRPLURJU0NPVkVSWSBERSBMQU1CREFTXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIERlc2N1YnJlIGF1dG9tw6F0aWNhbWVudGUgdG9kYXMgbGFzIGxhbWJkYXMgZW4gZWwgZGlyZWN0b3JpbyBlc3BlY2lmaWNhZG9cclxuICogeSBleHRyYWUgc3UgbWV0YWRhdGEgcGFyYSBhdXRvLWNvbmZpZ3VyYWNpw7NuXHJcbiAqL1xyXG5mdW5jdGlvbiBkaXNjb3ZlckxhbWJkYXMobGFtYmRhRGlyOiBzdHJpbmcpOiBEaXNjb3ZlcmVkTGFtYmRhW10ge1xyXG4gIGNvbnN0IGFic29sdXRlUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIGxhbWJkYURpcik7XHJcblxyXG4gIGNvbnNvbGUubG9nKGBcXG7wn5SNIERpc2NvdmVyaW5nIGxhbWJkYXMgaW46ICR7YWJzb2x1dGVQYXRofWApO1xyXG5cclxuICBpZiAoIWZzLmV4aXN0c1N5bmMoYWJzb2x1dGVQYXRoKSkge1xyXG4gICAgY29uc29sZS53YXJuKGDimqDvuI8gIExhbWJkYSBkaXJlY3Rvcnkgbm90IGZvdW5kOiAke2Fic29sdXRlUGF0aH1gKTtcclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmMoYWJzb2x1dGVQYXRoKVxyXG4gICAgLmZpbHRlcihmID0+IGYuZW5kc1dpdGgoJy5qcycpICYmICFmLnN0YXJ0c1dpdGgoJ18nKSAmJiAhZi5zdGFydHNXaXRoKCcuJykpO1xyXG5cclxuICBjb25zb2xlLmxvZyhg8J+TpiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gbGFtYmRhIGZpbGVzYCk7XHJcblxyXG4gIGNvbnN0IGRpc2NvdmVyZWQ6IERpc2NvdmVyZWRMYW1iZGFbXSA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgIGNvbnN0IG5hbWUgPSBmaWxlLnJlcGxhY2UoJy5qcycsICcnKTtcclxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGFic29sdXRlUGF0aCwgZmlsZSk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gSW50ZW50YXIgY2FyZ2FyIGVsIG3Ds2R1bG8gcGFyYSBsZWVyIG1ldGFkYXRhXHJcbiAgICAgIC8vIE5PVEE6IEVuIHRpZW1wbyBkZSBDREsgc3ludGgsIGVzdG8gcmVxdWllcmUgcXVlIGxvcyBtw7NkdWxvcyBzZWFuIHbDoWxpZG9zXHJcbiAgICAgIC8vIFNpIGhheSBlcnJvcmVzIGRlIHJlcXVpcmUgKGZhbHRhbiBkZXBzKSwgdXNhbW9zIG1ldGFkYXRhIHBvciBkZWZlY3RvXHJcbiAgICAgIGRlbGV0ZSByZXF1aXJlLmNhY2hlW3JlcXVpcmUucmVzb2x2ZShmaWxlUGF0aCldO1xyXG4gICAgICBjb25zdCBtb2R1bGUgPSByZXF1aXJlKGZpbGVQYXRoKTtcclxuXHJcbiAgICAgIGNvbnN0IG1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YSA9IG1vZHVsZS5tZXRhZGF0YSB8fCB7XHJcbiAgICAgICAgcm91dGU6IGAvJHtuYW1lfWAsXHJcbiAgICAgICAgbWV0aG9kczogWydHRVQnLCAnUE9TVCddLFxyXG4gICAgICAgIGF1dGg6IHRydWUsXHJcbiAgICAgICAgcm9sZXM6IFsnKiddLFxyXG4gICAgICAgIHByb2ZpbGU6ICdtZWRpdW0nLFxyXG4gICAgICAgIHRhYmxlczogW11cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGRpc2NvdmVyZWQucHVzaCh7XHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBmaWxlTmFtZTogZmlsZSxcclxuICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICBtZXRhZGF0YVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKGAgIOKchSAke25hbWV9OiAke21ldGFkYXRhLnJvdXRlfSBbJHttZXRhZGF0YS5wcm9maWxlfV0gJHttZXRhZGF0YS5hdXRoID8gJ/CflJInIDogJ/CfjJAnfWApO1xyXG5cclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS53YXJuKGAgIOKaoO+4jyAgQ291bGQgbm90IGxvYWQgbWV0YWRhdGEgZm9yICR7ZmlsZX06YCwgZXJyb3IubWVzc2FnZSk7XHJcblxyXG4gICAgICAvLyBVc2FyIG1ldGFkYXRhIHBvciBkZWZlY3RvIHNpIG5vIHNlIHB1ZWRlIGNhcmdhclxyXG4gICAgICBjb25zdCBkZWZhdWx0TWV0YWRhdGE6IExhbWJkYU1ldGFkYXRhID0ge1xyXG4gICAgICAgIHJvdXRlOiBgLyR7bmFtZX1gLFxyXG4gICAgICAgIG1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnXSxcclxuICAgICAgICBhdXRoOiB0cnVlLFxyXG4gICAgICAgIHJvbGVzOiBbJyonXSxcclxuICAgICAgICBwcm9maWxlOiAnbWVkaXVtJyxcclxuICAgICAgICB0YWJsZXM6IFtdXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBkaXNjb3ZlcmVkLnB1c2goe1xyXG4gICAgICAgIG5hbWUsXHJcbiAgICAgICAgZmlsZU5hbWU6IGZpbGUsXHJcbiAgICAgICAgZmlsZVBhdGgsXHJcbiAgICAgICAgbWV0YWRhdGE6IGRlZmF1bHRNZXRhZGF0YVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKGAgIOKaoO+4jyAgJHtuYW1lfTogVXNpbmcgZGVmYXVsdCBtZXRhZGF0YWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc29sZS5sb2coYFxcbuKchSBEaXNjb3ZlcnkgY29tcGxldGU6ICR7ZGlzY292ZXJlZC5sZW5ndGh9IGxhbWJkYXMgY29uZmlndXJlZFxcbmApO1xyXG5cclxuICByZXR1cm4gZGlzY292ZXJlZDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEJveUhhcHB5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIEJ1Y2tldHMgUzNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IGltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0ltYWdlc0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYGJveWhhcHB5LWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG1hdGVyaWFsZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdNYXRlcmlhbGVzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktbWF0ZXJpYWxlcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgY29yczogW3tcclxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVF0sXHJcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBiYWNrdXBzIGF1dG9tw6F0aWNvc1xyXG4gICAgLy8gRlJFRSBUSUVSOiBTaW4gdmVyc2lvbmFkbyBwYXJhIGV2aXRhciBjb3N0b3MgYWRpY2lvbmFsZXNcclxuICAgIGNvbnN0IGJhY2t1cHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWNrdXBzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktYmFja3Vwcy0ke3RoaXMuYWNjb3VudH1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sIC8vIFJFVEFJTiBwYXJhIG5vIHBlcmRlciBiYWNrdXBzXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIEZSRUUgVElFUjogRGVzYWN0aXZhZG8gcGFyYSBldml0YXIgY29zdG9zXHJcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbe1xyXG4gICAgICAgIC8vIFJldGVuZXIgc29sbyA3IGTDrWFzIGRlIGJhY2t1cHMgcGFyYSBtYW50ZW5lcnNlIGVuIEZyZWUgVGllclxyXG4gICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpXHJcbiAgICAgIH1dXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCdWNrZXQgcGFyYSBmcm9udGVuZCBlc3TDoXRpY28gKEhUTUwvQ1NTL0pTKVxyXG4gICAgLy8gRlJFRSBUSUVSOiBTMyBTdGF0aWMgV2Vic2l0ZSBIb3N0aW5nIChzaW4gQ2xvdWRGcm9udCBwYXJhIGV2aXRhciBjb3N0b3MpXHJcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYm95aGFwcHktZnJvbnRlbmQtJHt0aGlzLmFjY291bnR9YCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIC8vIENvbmZpZ3VyYWNpw7NuIHBhcmEgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAocMO6YmxpY28pXHJcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXHJcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSBmYWxsYmFja1xyXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLCAvLyBQZXJtaXRlIGFjY2VzbyBww7pibGljbyBwYXJhIFN0YXRpYyBXZWJzaXRlXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xyXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcclxuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2VcclxuICAgICAgfSksXHJcbiAgICAgIGNvcnM6IFt7XHJcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcclxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ11cclxuICAgICAgfV1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIFRBQkxBUyBEWU5BTU9EQiBPUFRJTUlaQURBU1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgIC8vIDEuIFRBQkxBIFVTVUFSSU9TXHJcbiAgICAvLyBGUkVFIFRJRVI6IFBST1ZJU0lPTkVEIG1vZGUgY29uIDUgUkNVL1dDVSAoZ3JhdGlzIHBlcm1hbmVudGVtZW50ZSlcclxuICAgIGNvbnN0IHVzdWFyaW9zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzdWFyaW9zVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ1VzdWFyaW9zJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogNSwgIC8vIEZSRUUgVElFUjogMjUgUkNVIHRvdGFsZXMgY29tcGFydGlkYXMgZW50cmUgdG9kYXMgbGFzIHRhYmxhc1xyXG4gICAgICB3cml0ZUNhcGFjaXR5OiA1LCAvLyBGUkVFIFRJRVI6IDI1IFdDVSB0b3RhbGVzIGNvbXBhcnRpZGFzIGVudHJlIHRvZGFzIGxhcyB0YWJsYXNcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHVzdWFyaW9zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFbWFpbEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjb3JyZW8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMi4gVEFCTEEgQ09NVU5JQ0FDSU9ORVMgKGZ1c2lvbmEgQW51bmNpb3MgKyBFdmVudG9zICsgTWF0cmljdWxhcylcclxuICAgIGNvbnN0IGNvbXVuaWNhY2lvbmVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NvbXVuaWNhY2lvbmVzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0NvbXVuaWNhY2lvbmVzJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgZmlsdHJhciBwb3IgdGlwbyB5IGZlY2hhXHJcbiAgICBjb211bmljYWNpb25lc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0ZlY2hhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBmaWx0cmFyIG1hdHLDrWN1bGFzIHBvciBlc3RhZG9cclxuICAgIGNvbXVuaWNhY2lvbmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFc3RhZG9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXN0YWRvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDMuIFRBQkxBIEFTSVNURU5DSUFcclxuICAgIGNvbnN0IGFzaXN0ZW5jaWFUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXNpc3RlbmNpYVRhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBc2lzdGVuY2lhJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgYXNpc3RlbmNpYVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29GZWNoYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjdXJzbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGFzaXN0ZW5jaWFUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0FsdW1ub0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXRBbHVtbm8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0LiBUQUJMQSBSRUNVUlNPUyBBQ0FERU1JQ09TIChmdXNpb25hIE5vdGFzICsgTWF0ZXJpYWxlcyArIEJpdMOhY29yYSArIENhdGVnb3LDrWFzKVxyXG4gICAgY29uc3QgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JlY3Vyc29zQWNhZGVtaWNvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdSZWN1cnNvc0FjYWRlbWljb3MnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGlwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAzLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBhbHVtbm8gKG5vdGFzKVxyXG4gICAgcmVjdXJzb3NBY2FkZW1pY29zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncnV0QWx1bW5vJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGEnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR1NJIHBhcmEgY29uc3VsdGFzIHBvciBjdXJzbyB5IGFzaWduYXR1cmFcclxuICAgIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ3Vyc29Bc2lnbmF0dXJhSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2N1cnNvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXNpZ25hdHVyYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBqZXJhcnF1w61hIGRlIGNhdGVnb3LDrWFzIChwYXJlbnQtY2hpbGQpXHJcbiAgICByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1BhcmVudENhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwYXJlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKchSBHU0kgcGFyYSBidXNjYXIgc29sbyBwb3IgSUQgKHNpbiB0aXBvKSAtIFBlcm1pdGUgR2V0Q29tbWFuZCBjb24gc29sbyB7aWR9XHJcbiAgICAvLyBOT1RBOiBBdW5xdWUgc2UgcHVlZGUgdXNhciBHZXRDb21tYW5kIGNvbiB7aWQsIHRpcG99LCBlc3RlIEdTSSBwZXJtaXRlIHF1ZXJpZXMgbcOhcyBmbGV4aWJsZXNcclxuICAgIC8vIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgIC8vICAgaW5kZXhOYW1lOiAnSWRJbmRleCcsXHJcbiAgICAvLyAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgLy8gICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgLy8gfSk7XHJcbiAgICAvLyBDT01FTlRBRE86IEVuIHJlYWxpZGFkIG5vIGVzIG5lY2VzYXJpbyB1biBHU0kgcGFyYSBHZXRDb21tYW5kLlxyXG4gICAgLy8gR2V0Q29tbWFuZCBmdW5jaW9uYSBjb24gcGFydGl0aW9uIGtleSArIHNvcnQga2V5OiB7aWQsIHRpcG99XHJcbiAgICAvLyBFbCBiYWNrZW5kIGZ1ZSBhY3R1YWxpemFkbyBwYXJhIGZ1bmNpb25hciBhc8OtLlxyXG5cclxuICAgIC8vIDUuIFRBQkxBIFJFVFJPQUxJTUVOVEFDSU9OICh1bmlmaWNhIHRvZGFzIGxhcyBvYnNlcnZhY2lvbmVzKVxyXG4gICAgY29uc3QgcmV0cm9hbGltZW50YWNpb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmV0cm9hbGltZW50YWNpb25UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnUmV0cm9hbGltZW50YWNpb24nLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dFVzdWFyaW8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGNvbnN1bHRhcyBwb3Igb3JpZ2VuIHkgZmVjaGFcclxuICAgIHJldHJvYWxpbWVudGFjaW9uVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdPcmlnZW5GZWNoYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdvcmlnZW4nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmZWNoYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA2LiBUQUJMQSBBR0VOREEgRk9OT0FVRElPTE9HSUEgKHJlbm9tYnJhZGEpXHJcbiAgICBjb25zdCBhZ2VuZGFGb25vVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0FnZW5kYUZvbm9UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQWdlbmRhRm9ub2F1ZGlvbG9naWEnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZlY2hhSG9yYScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcclxuICAgICAgcmVhZENhcGFjaXR5OiAyLFxyXG4gICAgICB3cml0ZUNhcGFjaXR5OiAyLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNy4gVEFCTEEgQ09ORklHVVJBQ0lPTlxyXG4gICAgY29uc3QgY29uZmlndXJhY2lvblRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDb25maWd1cmFjaW9uVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0NvbmZpZ3VyYWNpb24nLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDEsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDEsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA3LjUuIFRBQkxBIE1BVEVSSUFMQ0FURUdPUklBUyAoUmVsYWNpw7NuIE1hbnktdG8tTWFueSlcclxuICAgIGNvbnN0IG1hdGVyaWFsQ2F0ZWdvcmlhc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdNYXRlcmlhbENhdGVnb3JpYXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnTWF0ZXJpYWxDYXRlZ29yaWFzJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdtYXRlcmlhbElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY2F0ZWdvcmlhSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBBdXRvLXNjYWxpbmcgcGFyYSBtZWpvciBlc2NhbGFiaWxpZGFkXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgaW52ZXJzbyBwYXJhIGNvbnN1bHRhciBtYXRlcmlhbGVzIHBvciBjYXRlZ29yw61hXHJcbiAgICBtYXRlcmlhbENhdGVnb3JpYXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0NhdGVnb3JpYUluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjYXRlZ29yaWFJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ21hdGVyaWFsSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gOC4gVEFCTEEgSU5GT1JNRVMgKE5VRVZBIC0gRkFTRSA1KVxyXG4gICAgY29uc3QgaW5mb3JtZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW5mb3JtZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnSW5mb3JtZXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBpbmZvcm1lc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQWx1bW5vSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3J1dEFsdW1ubycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2ZlY2hhJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGluZm9ybWVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdUaXBvSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gOS4gVEFCTEEgUkVQT1JURVMgKE5VRVZBIC0gRkFTRSA5KVxyXG4gICAgY29uc3QgcmVwb3J0ZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVwb3J0ZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnUmVwb3J0ZXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGFHZW5lcmFjaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXBvcnRlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVGlwb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0aXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmVjaGFHZW5lcmFjaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDEwLiBUQUJMQSBBUE9ERVJBRE9TIChOVUVWQSAtIFJlbGFjaW9uZXMgQXBvZGVyYWRvLUFsdW1ubylcclxuICAgIGNvbnN0IGFwb2RlcmFkb3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXBvZGVyYWRvc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBcG9kZXJhZG9zJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdydXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGLDunNxdWVkYSBwb3IgY29ycmVvXHJcbiAgICBhcG9kZXJhZG9zVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdFbWFpbEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjb3JyZW8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMTEuIFRBQkxBIEFQT0RFUkFETy1BTFVNTk8gKFJlbGFjacOzbiBOOk4pXHJcbiAgICBjb25zdCBhcG9kZXJhZG9BbHVtbm9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXBvZGVyYWRvQWx1bW5vVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0Fwb2RlcmFkb0FsdW1ubycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnYXBvZGVyYWRvUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYWx1bW5vUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxyXG4gICAgICByZWFkQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHdyaXRlQ2FwYWNpdHk6IDIsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHU0kgcGFyYSBxdWVyaWVzIGludmVyc2FzIChidXNjYXIgYXBvZGVyYWRvcyBwb3IgYWx1bW5vKVxyXG4gICAgYXBvZGVyYWRvQWx1bW5vVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdBbHVtbm9JbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnYWx1bW5vUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXBvZGVyYWRvUnV0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDEyLiBUQUJMQSBQUk9GRVNPUi1DVVJTTyAoUmVsYWNpw7NuIDE6TiBjb24gdGlwb3MpXHJcbiAgICBjb25zdCBwcm9mZXNvckN1cnNvVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Byb2Zlc29yQ3Vyc29UYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnUHJvZmVzb3JDdXJzbycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncHJvZmVzb3JSdXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjdXJzb1RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBcIjFBI2plZmVcIiBvIFwiMUEjYXNpZ25hdHVyYSNNYXRlbcOhdGljYXNcIlxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXHJcbiAgICAgIHJlYWRDYXBhY2l0eTogMixcclxuICAgICAgd3JpdGVDYXBhY2l0eTogMixcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdTSSBwYXJhIGxpc3RhciBwcm9mZXNvcmVzIGRlIHVuIGN1cnNvXHJcbiAgICBwcm9mZXNvckN1cnNvVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdDdXJzb0luZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjdXJzbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gTGFtYmRhIExheWVyIGNvbiBkZXBlbmRlbmNpYXMgY29tdW5lc1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgY29tbW9uTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnQ29tbW9uRGVwZW5kZW5jaWVzTGF5ZXInLCB7XHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vbGF5ZXJzL2NvbW1vbicpLFxyXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWF0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIFNESyB2MyArIHV0aWxpZGFkZXMgY29tdW5lcyAocmVzcG9uc2UsIGxvZ2dlciwgdmFsaWRhdGlvbiknLFxyXG4gICAgICBsYXllclZlcnNpb25OYW1lOiAnYm95aGFwcHktY29tbW9uLWRlcGVuZGVuY2llcycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBIZWxwZXIgcGFyYSBjcmVhciBMYW1iZGFzIGNvbiBjb25maWd1cmFjacOzbiBvcHRpbWl6YWRhXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBpbnRlcmZhY2UgTGFtYmRhQ29uZmlnIHtcclxuICAgICAgbWVtb3J5PzogbnVtYmVyO1xyXG4gICAgICB0aW1lb3V0PzogbnVtYmVyO1xyXG4gICAgICBjb25jdXJyZW5jeT86IG51bWJlcjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBMQU1CREFfUFJPRklMRVMgPSB7XHJcbiAgICAgIGxpZ2h0OiB7IG1lbW9yeTogMjU2LCB0aW1lb3V0OiAxMCB9LCAgICAvLyBBdXRoLCBjYWxsYmFja3NcclxuICAgICAgbWVkaXVtOiB7IG1lbW9yeTogNTEyLCB0aW1lb3V0OiAxNSB9LCAgIC8vIENSVUQgb3BlcmF0aW9uc1xyXG4gICAgICBoZWF2eTogeyBtZW1vcnk6IDEwMjQsIHRpbWVvdXQ6IDMwIH0sICAgLy8gUmVwb3J0ZXMsIFMzLCBiYWNrdXBzXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGNyZWF0ZUxhbWJkYSA9IChcclxuICAgICAgbmFtZTogc3RyaW5nLFxyXG4gICAgICBoYW5kbGVyRmlsZTogc3RyaW5nLFxyXG4gICAgICBoYW5kbGVyTmFtZTogc3RyaW5nID0gJ2hhbmRsZXInLFxyXG4gICAgICBlbnZpcm9ubWVudDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9LFxyXG4gICAgICBjb25maWc6IExhbWJkYUNvbmZpZyA9IExBTUJEQV9QUk9GSUxFUy5tZWRpdW1cclxuICAgICkgPT4ge1xyXG4gICAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBuYW1lLCB7XHJcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgICAgaGFuZGxlcjogYCR7aGFuZGxlckZpbGV9LiR7aGFuZGxlck5hbWV9YCxcclxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uJywge1xyXG4gICAgICAgICAgZXhjbHVkZTogW1xyXG4gICAgICAgICAgICAnaW5mcmEvKionLFxyXG4gICAgICAgICAgICAnZnJvbnRlbmQvKionLFxyXG4gICAgICAgICAgICAnc2NyaXB0cy8qKicsXHJcbiAgICAgICAgICAgICdkaXN0LyoqJyxcclxuICAgICAgICAgICAgJyoubWQnLFxyXG4gICAgICAgICAgICAnLmdpdC8qKicsXHJcbiAgICAgICAgICAgICdub2RlX21vZHVsZXMvKionLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgIC4uLmVudmlyb25tZW50LFxyXG4gICAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcclxuICAgICAgICAgIE5PREVfT1BUSU9OUzogJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyxcclxuICAgICAgICAgIExBU1RfREVQTE9ZOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgfSxcclxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcudGltZW91dCB8fCAxMCksXHJcbiAgICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLm1lbW9yeSB8fCAzODQsXHJcbiAgICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXHJcbiAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBBUEkgR0FURVdBWSAtIENSRUFSIFBSSU1FUk8gUEFSQSBPQlRFTkVSIExBIFVSTFxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnQm95SGFwcHlBcGknLCB7XHJcbiAgICAgIHJlc3RBcGlOYW1lOiAnQm95SGFwcHkgU2VydmljZScsXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcclxuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gQ09SUzogUGVybWl0aXIgdG9kb3MgbG9zIG9yw61nZW5lcyAodmFsaWRhY2nDs24gZW4gbGFtYmRhcyBtZWRpYW50ZSBhdXRoTWlkZGxld2FyZSlcclxuICAgICAgICAvLyBOT1RBOiBDbG91ZEZyb250IHdpbGRjYXJkICgqLmNsb3VkZnJvbnQubmV0KSBOTyBlc3TDoSBzb3BvcnRhZG8gZW4gQVBJIEdhdGV3YXlcclxuICAgICAgICAvLyBQYXJhIHByb2R1Y2Npw7NuLCBlc3BlY2lmaWNhIGVsIGRvbWluaW8gZXhhY3RvIGRlIENsb3VkRnJvbnQgZGVzcHXDqXMgZGVsIGRlcGxveVxyXG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxyXG4gICAgICAgICAgJ0Nvb2tpZScsXHJcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXHJcbiAgICAgICAgICAnWC1BcGktS2V5JyxcclxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXHJcbiAgICAgICAgICAnWC1SZXF1ZXN0ZWQtV2l0aCdcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXHJcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24ubWludXRlcygxMClcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbnN0cnVpciBsYSBVUkwgZGVsIEFQSSBHYXRld2F5IG1hbnVhbG1lbnRlIHNpbiBjcmVhciBkZXBlbmRlbmNpYSBjaXJjdWxhclxyXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vJHthcGkucmVzdEFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tL3Byb2RgO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIE1BUEEgREUgVEFCTEFTIFBBUkEgQVVUTy1HUkFOVFxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgY29uc3QgdGFibGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPihbXHJcbiAgICAgIFsnVXN1YXJpb3MnLCB1c3Vhcmlvc1RhYmxlXSxcclxuICAgICAgWydDb211bmljYWNpb25lcycsIGNvbXVuaWNhY2lvbmVzVGFibGVdLFxyXG4gICAgICBbJ1JlY3Vyc29zQWNhZGVtaWNvcycsIHJlY3Vyc29zQWNhZGVtaWNvc1RhYmxlXSxcclxuICAgICAgWydBc2lzdGVuY2lhJywgYXNpc3RlbmNpYVRhYmxlXSxcclxuICAgICAgWydBZ2VuZGFGb25vJywgYWdlbmRhRm9ub1RhYmxlXSxcclxuICAgICAgWydJbmZvcm1lcycsIGluZm9ybWVzVGFibGVdLFxyXG4gICAgICBbJ1JlcG9ydGVzJywgcmVwb3J0ZXNUYWJsZV0sXHJcbiAgICAgIFsnQXBvZGVyYWRvcycsIGFwb2RlcmFkb3NUYWJsZV0sXHJcbiAgICAgIFsnQXBvZGVyYWRvQWx1bW5vJywgYXBvZGVyYWRvQWx1bW5vVGFibGVdLFxyXG4gICAgICBbJ1Byb2Zlc29yQ3Vyc28nLCBwcm9mZXNvckN1cnNvVGFibGVdLFxyXG4gICAgICBbJ1JldHJvYWxpbWVudGFjaW9uJywgcmV0cm9hbGltZW50YWNpb25UYWJsZV0sXHJcbiAgICAgIFsnTWF0ZXJpYWxDYXRlZ29yaWFzJywgbWF0ZXJpYWxDYXRlZ29yaWFzVGFibGVdXHJcbiAgICBdKTtcclxuXHJcbiAgICBjb25zdCBidWNrZXRzTWFwID0gbmV3IE1hcDxzdHJpbmcsIHMzLkJ1Y2tldD4oW1xyXG4gICAgICBbJ2ltYWdlcycsIGltYWdlc0J1Y2tldF0sXHJcbiAgICAgIFsnbWF0ZXJpYWxlcycsIG1hdGVyaWFsZXNCdWNrZXRdLFxyXG4gICAgICBbJ2JhY2t1cHMnLCBiYWNrdXBzQnVja2V0XSxcclxuICAgICAgWydmcm9udGVuZCcsIGZyb250ZW5kQnVja2V0XVxyXG4gICAgXSk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gRlVOQ0nDk046IEFVVE8tR1JBTlQgUEVSTUlTU0lPTlNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8qKlxyXG4gICAgICogT3RvcmdhIHBlcm1pc29zIGF1dG9tw6F0aWNhbWVudGUgYmFzw6FuZG9zZSBlbiBsYSBtZXRhZGF0YSBkZSBsYSBsYW1iZGFcclxuICAgICAqL1xyXG4gICAgY29uc3QgYXV0b0dyYW50UGVybWlzc2lvbnMgPSAoXHJcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24sXHJcbiAgICAgIG1ldGFkYXRhOiBMYW1iZGFNZXRhZGF0YVxyXG4gICAgKSA9PiB7XHJcbiAgICAgIC8vIDEuIFBlcm1pc29zIGRlIER5bmFtb0RCIFRhYmxlc1xyXG4gICAgICBpZiAobWV0YWRhdGEudGFibGVzICYmIG1ldGFkYXRhLnRhYmxlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCB0YWJsZVNwZWMgb2YgbWV0YWRhdGEudGFibGVzKSB7XHJcbiAgICAgICAgICAvLyBGb3JtYXRvOiBcIlRhYmxlTmFtZVwiIG8gXCJUYWJsZU5hbWU6cmVhZFwiIG8gXCJUYWJsZU5hbWU6d3JpdGVcIlxyXG4gICAgICAgICAgY29uc3QgW3RhYmxlTmFtZSwgYWNjZXNzVHlwZSA9ICdyZWFkd3JpdGUnXSA9IHRhYmxlU3BlYy5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgY29uc3QgdGFibGUgPSB0YWJsZXNNYXAuZ2V0KHRhYmxlTmFtZSk7XHJcblxyXG4gICAgICAgICAgaWYgKHRhYmxlKSB7XHJcbiAgICAgICAgICAgIGlmIChhY2Nlc3NUeXBlID09PSAncmVhZCcpIHtcclxuICAgICAgICAgICAgICB0YWJsZS5ncmFudFJlYWREYXRhKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk5YgR3JhbnRlZCBSRUFEIG9uICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjY2Vzc1R5cGUgPT09ICd3cml0ZScpIHtcclxuICAgICAgICAgICAgICB0YWJsZS5ncmFudFdyaXRlRGF0YShsYW1iZGFGdW5jdGlvbik7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYCAgICDinI3vuI8gIEdyYW50ZWQgV1JJVEUgb24gJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgIPCfk50gR3JhbnRlZCBSRUFEL1dSSVRFIG9uICR7dGFibGVOYW1lfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCAgICDimqDvuI8gIFRhYmxlIG5vdCBmb3VuZDogJHt0YWJsZU5hbWV9YCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyAyLiBQb2zDrXRpY2FzIGFkaWNpb25hbGVzIChTRVMsIENvZ25pdG8sIFMzLCBldGMpXHJcbiAgICAgIGlmIChtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXMgJiYgbWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHBvbGljeSBvZiBtZXRhZGF0YS5hZGRpdGlvbmFsUG9saWNpZXMpIHtcclxuICAgICAgICAgIGNvbnN0IHJlc291cmNlcyA9IHBvbGljeS5yZXNvdXJjZXMubWFwKHIgPT4ge1xyXG4gICAgICAgICAgICAvLyBFeHBhbmRpciByZWN1cnNvcyBlc3BlY2lhbGVzXHJcbiAgICAgICAgICAgIGlmIChyID09PSAndXNlcnBvb2wnKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGBhcm46YXdzOmNvZ25pdG8taWRwOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp1c2VycG9vbC8ke3Byb2Nlc3MuZW52LlVTRVJfUE9PTF9JRH1gO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgbGFtYmRhRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgYWN0aW9uczogcG9saWN5LmFjdGlvbnMsXHJcbiAgICAgICAgICAgIHJlc291cmNlczogcmVzb3VyY2VzXHJcbiAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgY29uc29sZS5sb2coYCAgICDwn5SQIEdyYW50ZWQgY3VzdG9tIHBvbGljeTogJHtwb2xpY3kuYWN0aW9ucy5qb2luKCcsICcpfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBMQU1CREFTIE9QVElNSVpBREFTIC0gVXNhciBhcGlVcmwgY29uc3RydWlkYSBkaW7DoW1pY2FtZW50ZVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgIC8vIEZyb250ZW5kIFNlcnZlciBMYW1iZGEgLSBTT0xPIFBBUkEgREVTQVJST0xMTyBMT0NBTCAoZGV2LXNlcnZlci5qcylcclxuICAgIC8vIEVuIHByb2R1Y2Npw7NuLCBlbCBmcm9udGVuZCBzZSBzaXJ2ZSBkZXNkZSBDbG91ZEZyb250ICsgUzNcclxuICAgIC8vIEVzdGEgbGFtYmRhIHNlIG1hbnRpZW5lIGRlcGxveWFkYSBwZXJvIE5PIHNlIHVzYSBlbiBwcm9kdWNjacOzblxyXG4gICAgLy8g4pqg77iPIEVMSU1JTkFETzogRnJvbnRlbmQgYWhvcmEgZXMgU1BBIHNlcnZpZGEgZGVzZGUgUzNcclxuICAgIC8vIEB0cy1pZ25vcmUgLSBUZW1wb3JhcnkgY29tcGF0aWJpbGl0eVxyXG4gICAgY29uc3QgZnJvbnRlbmRTZXJ2ZXJMYW1iZGEgPSBudWxsIGFzIGFueTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIFRPREFTIExBUyBMQU1CREFTIEFIT1JBIFVTQU4gQVVUTy1ESVNDT1ZFUllcclxuICAgIC8vIExhcyBsYW1iZGFzIHNlIGRlc2N1YnJlbiBhdXRvbcOhdGljYW1lbnRlIGRlc2RlIGxhIGNhcnBldGEgYXBpL1xyXG4gICAgLy8geSBzZSBjb25maWd1cmFuIHVzYW5kbyBlbCBtZXRhZGF0YSBleHBvcnRhZG8gZW4gY2FkYSBhcmNoaXZvXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIPCfhpUgQVVUTy1ESVNDT1ZFUlkgREUgTEFNQkRBU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zb2xlLmxvZygnXFxu8J+agCBTdGFydGluZyBMYW1iZGEgQXV0by1EaXNjb3ZlcnkuLi4nKTtcclxuXHJcbiAgICAvLyBEZXNjdWJyaXIgdG9kYXMgbGFzIGxhbWJkYXMgZW4gL2FwaVxyXG4gICAgY29uc3QgZGlzY292ZXJlZExhbWJkYXMgPSBkaXNjb3ZlckxhbWJkYXMoJy4uLy4uL2FwaScpO1xyXG5cclxuICAgIC8vIENyZWFyIHVuIG1hcGEgZGUgbGFtYmRhcyBjcmVhZGFzIGF1dG9tw6F0aWNhbWVudGVcclxuICAgIGNvbnN0IGF1dG9MYW1iZGFzID0gbmV3IE1hcDxzdHJpbmcsIGxhbWJkYS5GdW5jdGlvbj4oKTtcclxuICAgIGNvbnN0IGF1dG9Sb3V0ZU1hcDogUmVjb3JkPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPiA9IHt9O1xyXG5cclxuICAgIC8vIFByb2Nlc2FyIFRPREFTIGxhcyBsYW1iZGFzIGRpc2NvdmVyZWQgcXVlIHRlbmdhbiBtZXRhZGF0YSB2w6FsaWRhXHJcbiAgICBjb25zdCBsYW1iZGFzVG9DcmVhdGUgPSBkaXNjb3ZlcmVkTGFtYmRhcy5maWx0ZXIobCA9PiB7XHJcbiAgICAgIC8vIEV4Y2x1aXIgbGFtYmRhcyBxdWUgY2xhcmFtZW50ZSBubyBzb24gQVBJIGVuZHBvaW50c1xyXG4gICAgICBjb25zdCBleGNsdWRlZCA9IFsnaGFuZGxlcicsICdpbmRleCcsICdfdGVtcGxhdGUnLCAncmVxdWlyZUxheWVyJ107XHJcbiAgICAgIHJldHVybiAhZXhjbHVkZWQuaW5jbHVkZXMobC5uYW1lKSAmJiBsLm1ldGFkYXRhLnJvdXRlO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc29sZS5sb2coYFxcbvCfk4sgQ3JlYXRpbmcgJHtsYW1iZGFzVG9DcmVhdGUubGVuZ3RofSBhdXRvLWRpc2NvdmVyZWQgbGFtYmRhcy4uLlxcbmApO1xyXG5cclxuICAgIGZvciAoY29uc3QgZGlzY292ZXJlZCBvZiBsYW1iZGFzVG9DcmVhdGUpIHtcclxuICAgICAgY29uc3QgeyBuYW1lLCBtZXRhZGF0YSB9ID0gZGlzY292ZXJlZDtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SoIENyZWF0aW5nIGxhbWJkYTogJHtuYW1lfWApO1xyXG5cclxuICAgICAgLy8gRGV0ZXJtaW5hciBwcm9maWxlXHJcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBMQU1CREFfUFJPRklMRVNbbWV0YWRhdGEucHJvZmlsZSB8fCAnbWVkaXVtJ107XHJcblxyXG4gICAgICAvLyBDb25zdHJ1aXIgZW52aXJvbm1lbnQgdmFyaWFibGVzIGF1dG9tw6F0aWNhbWVudGVcclxuICAgICAgY29uc3QgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuXHJcbiAgICAgIC8vIEFncmVnYXIgQVBJX1VSTCBzaSBlcyBuZWNlc2FyaW9cclxuICAgICAgZW52aXJvbm1lbnRbJ0FQSV9VUkwnXSA9IGFwaVVybDtcclxuXHJcbiAgICAgIC8vIEFncmVnYXIgVVNFUl9QT09MX0lEIHNpIHRpZW5lIHBvbMOtdGljYXMgZGUgQ29nbml0b1xyXG4gICAgICBpZiAobWV0YWRhdGEuYWRkaXRpb25hbFBvbGljaWVzPy5zb21lKHAgPT4gcC5yZXNvdXJjZXMuaW5jbHVkZXMoJ3VzZXJwb29sJykpKSB7XHJcbiAgICAgICAgZW52aXJvbm1lbnRbJ1VTRVJfUE9PTF9JRCddID0gcHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEIHx8ICcnO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBBZ3JlZ2FyIHZhcmlhYmxlcyBkZSB0YWJsYSBhdXRvbcOhdGljYW1lbnRlXHJcbiAgICAgIGlmIChtZXRhZGF0YS50YWJsZXMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHRhYmxlU3BlYyBvZiBtZXRhZGF0YS50YWJsZXMpIHtcclxuICAgICAgICAgIGNvbnN0IFt0YWJsZU5hbWVdID0gdGFibGVTcGVjLnNwbGl0KCc6Jyk7XHJcbiAgICAgICAgICBjb25zdCB0YWJsZSA9IHRhYmxlc01hcC5nZXQodGFibGVOYW1lKTtcclxuICAgICAgICAgIGlmICh0YWJsZSkge1xyXG4gICAgICAgICAgICAvLyBDb252ZW5jacOzbjogVVNVQVJJT1NfVEFCTEUsIENPTVVOSUNBQ0lPTkVTX1RBQkxFLCBldGMuXHJcbiAgICAgICAgICAgIGNvbnN0IGVudlZhck5hbWUgPSBgJHt0YWJsZU5hbWUudG9VcHBlckNhc2UoKX1fVEFCTEVgO1xyXG4gICAgICAgICAgICBlbnZpcm9ubWVudFtlbnZWYXJOYW1lXSA9IHRhYmxlLnRhYmxlTmFtZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIENyZWFyIGxhIGxhbWJkYVxyXG4gICAgICBjb25zdCBsYW1iZGFGdW5jdGlvbiA9IGNyZWF0ZUxhbWJkYShcclxuICAgICAgICBgJHtuYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zbGljZSgxKX1MYW1iZGFgLFxyXG4gICAgICAgIGBhcGkvJHtuYW1lfWAsXHJcbiAgICAgICAgJ2hhbmRsZXInLFxyXG4gICAgICAgIGVudmlyb25tZW50LFxyXG4gICAgICAgIHByb2ZpbGVcclxuICAgICAgKTtcclxuXHJcbiAgICAgIC8vIEF1dG8tZ3JhbnQgcGVybWlzb3NcclxuICAgICAgYXV0b0dyYW50UGVybWlzc2lvbnMobGFtYmRhRnVuY3Rpb24sIG1ldGFkYXRhKTtcclxuXHJcbiAgICAgIC8vIEd1YXJkYXIgZW4gbWFwYVxyXG4gICAgICBhdXRvTGFtYmRhcy5zZXQobmFtZSwgbGFtYmRhRnVuY3Rpb24pO1xyXG4gICAgICBhdXRvUm91dGVNYXBbbWV0YWRhdGEucm91dGVdID0gbGFtYmRhRnVuY3Rpb247XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhgICDinIUgJHtuYW1lfSBjcmVhdGVkIHN1Y2Nlc3NmdWxseVxcbmApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnNvbGUubG9nKGBcXG7inIUgQXV0by1kaXNjb3ZlcnkgY29tcGxldGUhICR7bGFtYmRhc1RvQ3JlYXRlLmxlbmd0aH0gbGFtYmRhcyBjcmVhdGVkIGF1dG9tYXRpY2FsbHlcXG5gKTtcclxuICAgIGNvbnNvbGUubG9nKCfwn5ONIEF1dG8tZGlzY292ZXJlZCByb3V0ZXM6JywgT2JqZWN0LmtleXMoYXV0b1JvdXRlTWFwKS5qb2luKCcsICcpKTtcclxuICAgIGNvbnNvbGUubG9nKCdcXG4nICsgJz0nLnJlcGVhdCg4MCkgKyAnXFxuJyk7XHJcblxyXG4gICAgLy8gRXZlbnRCcmlkZ2UgUnVsZSBwYXJhIGJhY2t1cHMgZGlhcmlvcyBhIGxhcyAyIEFNIENoaWxlXHJcbiAgICBjb25zdCBiYWNrdXBMYW1iZGEgPSBhdXRvTGFtYmRhcy5nZXQoJ2JhY2t1cCcpO1xyXG4gICAgaWYgKGJhY2t1cExhbWJkYSkge1xyXG4gICAgICBjb25zdCBiYWNrdXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdCYWNrdXBEaWFyaW9SdWxlJywge1xyXG4gICAgICAgIHJ1bGVOYW1lOiAnYm95aGFwcHktYmFja3VwLWRpYXJpbycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdFamVjdXRhIGJhY2t1cCBhdXRvbcOhdGljbyBkaWFyaW8gYSBsYXMgMiBBTScsXHJcbiAgICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcclxuICAgICAgICAgIG1pbnV0ZTogJzAnLFxyXG4gICAgICAgICAgaG91cjogJzYnLCAvLyA2IEFNIFVUQyA9IDIgQU0gQ2hpbGUgKFVUQy00KVxyXG4gICAgICAgICAgZGF5OiAnKicsXHJcbiAgICAgICAgICBtb250aDogJyonLFxyXG4gICAgICAgICAgeWVhcjogJyonXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZW5hYmxlZDogdHJ1ZVxyXG4gICAgICB9KTtcclxuICAgICAgYmFja3VwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYmFja3VwTGFtYmRhKSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQmFja3VwIGRpYXJpbyBjb25maWd1cmFkbyBjb3JyZWN0YW1lbnRlXFxuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gQ09ORklHVVJBQ0nDk04gREUgUk9VVElORyBFTiBBUEkgR0FURVdBWVxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gVXNhciBTT0xPIGxhbWJkYXMgYXV0by1kZXNjdWJpZXJ0YXNcclxuICAgIGNvbnN0IHJvdXRlTWFwOiBSZWNvcmQ8c3RyaW5nLCBsYW1iZGEuRnVuY3Rpb24+ID0gYXV0b1JvdXRlTWFwO1xyXG5cclxuICAgIC8vIExhbWJkYSBSb3V0ZXIgY2VudHJhbGl6YWRvXHJcbiAgICBjb25zdCBhcGlSb3V0ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlSb3V0ZXJMYW1iZGEnLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxyXG5jb25zdCB7IExhbWJkYUNsaWVudCwgSW52b2tlQ29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWxhbWJkYScpO1xyXG5jb25zdCBsYW1iZGFDbGllbnQgPSBuZXcgTGFtYmRhQ2xpZW50KHt9KTtcclxuXHJcbmNvbnN0IFJPVVRFX01BUCA9ICR7SlNPTi5zdHJpbmdpZnkoXHJcbiAgT2JqZWN0LmZyb21FbnRyaWVzKFxyXG4gICAgT2JqZWN0LmVudHJpZXMocm91dGVNYXApLm1hcCgoW3JvdXRlLCBmbl0pID0+IFtyb3V0ZSwgZm4uZnVuY3Rpb25OYW1lXSlcclxuICApXHJcbil9O1xyXG5cclxuZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XHJcblxyXG4gIGxldCBwYXRoID0gZXZlbnQucGF0aCB8fCAnLyc7XHJcblxyXG4gIC8vIEVsaW1pbmFyIHByZWZpam8gL2FwaS8gc2kgZXhpc3RlXHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL2FwaS8nKSkge1xyXG4gICAgcGF0aCA9IHBhdGgucmVwbGFjZSgnL2FwaS8nLCAnLycpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgYmFzZVBhdGggPSAnLycgKyAocGF0aC5zcGxpdCgnLycpWzFdIHx8ICcnKTtcclxuXHJcbiAgLy8gQnVzY2FyIGxhbWJkYSBwb3IgcnV0YSBiYXNlXHJcbiAgbGV0IHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFtiYXNlUGF0aF0gfHwgUk9VVEVfTUFQW3BhdGhdO1xyXG5cclxuICAvLyBSdXRhcyBlc3BlY2lhbGVzIGNvbiBzdWItcGF0aHNcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbm90YXMvYWdydXBhZGFzJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL25vdGFzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL25vdGFzL3Byb21lZGlvcycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9ub3RhcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9tYXRlcmlhbGVzL2Fwcm9iYXInKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvbWF0ZXJpYWxlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9tYXRlcmlhbGVzL3JlY2hhemFyJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL21hdGVyaWFsZXMnXTtcclxuICBpZiAocGF0aC5zdGFydHNXaXRoKCcvbWF0ZXJpYWxlcy9jb3JyZWdpcicpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9tYXRlcmlhbGVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL3Nlc2lvbmVzL2FyY2hpdm9zJykpIHRhcmdldExhbWJkYSA9IFJPVVRFX01BUFsnL3Nlc2lvbmVzJ107XHJcbiAgaWYgKHBhdGguc3RhcnRzV2l0aCgnL3JlcG9ydGVzLycpKSB0YXJnZXRMYW1iZGEgPSBST1VURV9NQVBbJy9yZXBvcnRlcyddO1xyXG4gIGlmIChwYXRoLnN0YXJ0c1dpdGgoJy9leHBvcnRhci8nKSkgdGFyZ2V0TGFtYmRhID0gUk9VVEVfTUFQWycvZXhwb3J0YXInXTtcclxuXHJcbiAgLy8g4pqg77iPIEVMSU1JTkFETzogU3RhdGljIGZpbGVzIGFuZCBob21lIHJvdXRpbmdcclxuICAvLyBGcm9udGVuZCBpcyBub3cgc2VydmVkIGZyb20gUzMgU3RhdGljIFdlYnNpdGVcclxuXHJcbiAgaWYgKCF0YXJnZXRMYW1iZGEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDQwNCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1JvdXRlIG5vdCBmb3VuZCcsIHBhdGggfSlcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICB0cnkge1xyXG4gICAgY29uc29sZS5sb2coJ0ludm9raW5nIGxhbWJkYTonLCB0YXJnZXRMYW1iZGEsICd3aXRoIHBhdGg6JywgcGF0aCk7XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBsYW1iZGFDbGllbnQuc2VuZChuZXcgSW52b2tlQ29tbWFuZCh7XHJcbiAgICAgIEZ1bmN0aW9uTmFtZTogdGFyZ2V0TGFtYmRhLFxyXG4gICAgICBJbnZvY2F0aW9uVHlwZTogJ1JlcXVlc3RSZXNwb25zZScsXHJcbiAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGV2ZW50KVxyXG4gICAgfSkpO1xyXG5cclxuICAgIGlmIChyZXNwb25zZS5GdW5jdGlvbkVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0xhbWJkYSBpbnZvY2F0aW9uIGVycm9yOicsIHJlc3BvbnNlLkZ1bmN0aW9uRXJyb3IpO1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdQYXlsb2FkOicsIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5QYXlsb2FkKSk7XHJcblxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IDUwMixcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6ICd0cnVlJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgZXJyb3I6ICdMYW1iZGEgZXhlY3V0aW9uIGVycm9yJyxcclxuICAgICAgICAgIGRldGFpbHM6IHJlc3BvbnNlLkZ1bmN0aW9uRXJyb3IsXHJcbiAgICAgICAgICBwYXlsb2FkOiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuUGF5bG9hZClcclxuICAgICAgICB9KVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UobmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3BvbnNlLlBheWxvYWQpKTtcclxuICAgIGNvbnNvbGUubG9nKCdMYW1iZGEgcmVzcG9uc2Ugc3RhdHVzOicsIHJlc3VsdC5zdGF0dXNDb2RlKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdSb3V0ZXIgZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgY29uc29sZS5lcnJvcignRXJyb3Igc3RhY2s6JywgZXJyb3Iuc3RhY2spO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDUwMCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZSdcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgcm91dGluZyBlcnJvcicsXHJcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcclxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2tcclxuICAgICAgfSlcclxuICAgIH07XHJcbiAgfVxyXG59O1xyXG4gICAgICBgKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIERhciBwZXJtaXNvcyBhbCByb3V0ZXIgcGFyYSBpbnZvY2FyIHRvZGFzIGxhcyBsYW1iZGFzXHJcbiAgICBPYmplY3QudmFsdWVzKHJvdXRlTWFwKS5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgZm4uZ3JhbnRJbnZva2UoYXBpUm91dGVyTGFtYmRhKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBUEkgR0FURVdBWSBST1VUSU5HXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gTk9UQTogRnJvbnRlbmQgc2Ugc2lydmUgZGVzZGUgUzMgU3RhdGljIFdlYnNpdGUgSG9zdGluZyAoRlJFRSBUSUVSKVxyXG4gICAgLy8gICAgICAgZnJvbnRlbmRTZXJ2ZXJMYW1iZGEgc29sbyBzZSB1c2EgZW4gZGV2LXNlcnZlci5qcyBsb2NhbFxyXG4gICAgLy8gICAgICAgQmFja2VuZCBBUElzIHNlIGFjY2VkZW4gZGlyZWN0YW1lbnRlIHZpYSBBUEkgR2F0ZXdheVxyXG5cclxuICAgIC8vIFByb3h5IHBhcmEgQVBJcyAtIHRvZGFzIGxhcyBydXRhcyB2YW4gYWwgcm91dGVyXHJcbiAgICBjb25zdCBwcm94eSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xyXG4gICAgcHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlSb3V0ZXJMYW1iZGEpKTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBGUkVFIFRJRVI6IE5PIENMT1VERlJPTlRcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIENsb3VkRnJvbnQgc2UgaGEgZWxpbWluYWRvIHBhcmEgbWFudGVuZXJzZSBlbiBlbCBGcmVlIFRpZXJcclxuICAgIC8vIEVsIGZyb250ZW5kIHNlIHNpcnZlIGRlc2RlIFMzIFN0YXRpYyBXZWJzaXRlIEhvc3RpbmdcclxuICAgIC8vIExJTUlUQUNJw5NOOiBTb2xvIEhUVFAgKG5vIEhUVFBTKSBhIG1lbm9zIHF1ZSB1c2VzIENsb3VkRnJvbnQgKGNvc3RvIGV4dHJhKVxyXG4gICAgLy9cclxuICAgIC8vIFBhcmEgaGFiaWxpdGFyIEhUVFBTIGVuIGVsIGZ1dHVybyAoY29uIGNvc3RvKTpcclxuICAgIC8vIDEuIERlc2NvbWVudGFyIGVsIGPDs2RpZ28gZGUgQ2xvdWRGcm9udCBtw6FzIGFiYWpvXHJcbiAgICAvLyAyLiBBY3R1YWxpemFyIGZyb250ZW5kQnVja2V0IHBhcmEgdXNhciBPQUkgZW4gbHVnYXIgZGUgcHVibGljUmVhZEFjY2Vzc1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIE91dHB1dHNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbWFnZXNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogaW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWF0ZXJpYWxlc0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBtYXRlcmlhbGVzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmFja3Vwc0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBiYWNrdXBzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVja2V0IGRlIGJhY2t1cHMgYXV0b23DoXRpY29zIChyZXRlbmNpw7NuIDMwIGTDrWFzKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdCdWNrZXQgUzMgcGFyYSBhcmNoaXZvcyBlc3TDoXRpY29zIGRlbCBmcm9udGVuZCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdCb3lIYXBweUZyb250ZW5kQnVja2V0J1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kV2Vic2l0ZVVSTCcsIHtcclxuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldFdlYnNpdGVVcmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+MkCBVUkwgZGVsIEZyb250ZW5kIChTMyBTdGF0aWMgV2Vic2l0ZSAtIEZSRUUgVElFUikgLSBVU0FSIEVTVEEgVVJMJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0JveUhhcHB5RnJvbnRlbmRVUkwnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVSTCcsIHtcclxuICAgICAgdmFsdWU6IGFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAn8J+UlyBVUkwgZGUgQVBJIEdhdGV3YXkgKEJhY2tlbmQgQVBJcyknLFxyXG4gICAgICBleHBvcnROYW1lOiAnQm95SGFwcHlBcGlVUkwnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXN1YXJpb3NUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB1c3Vhcmlvc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdOb21icmUgZGUgbGEgdGFibGEgZGUgVXN1YXJpb3MnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbXVuaWNhY2lvbmVzVGFibGVOYW1lJywge1xyXG4gICAgICB2YWx1ZTogY29tdW5pY2FjaW9uZXNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm9tYnJlIGRlIGxhIHRhYmxhIGRlIENvbXVuaWNhY2lvbmVzIChhbnVuY2lvcytldmVudG9zK21hdHJpY3VsYXMpJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWN1cnNvc0FjYWRlbWljb3NUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiByZWN1cnNvc0FjYWRlbWljb3NUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm9tYnJlIGRlIGxhIHRhYmxhIGRlIFJlY3Vyc29zIEFjYWTDqW1pY29zIChub3RhcyttYXRlcmlhbGVzK2JpdMOhY29yYStjYXRlZ29yw61hcyknLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0luZm9ybWVzVGFibGVOYW1lJywge1xyXG4gICAgICB2YWx1ZTogaW5mb3JtZXNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm9tYnJlIGRlIGxhIHRhYmxhIGRlIEluZm9ybWVzIEZvbm9hdWRpb2zDs2dpY29zJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZXBvcnRlc1RhYmxlTmFtZScsIHtcclxuICAgICAgdmFsdWU6IHJlcG9ydGVzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ05vbWJyZSBkZSBsYSB0YWJsYSBkZSBSZXBvcnRlcyBDb25zb2xpZGFkb3MnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Fwb2RlcmFkb3NUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBhcG9kZXJhZG9zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ05vbWJyZSBkZSBsYSB0YWJsYSBkZSBBcG9kZXJhZG9zJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcG9kZXJhZG9BbHVtbm9UYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBhcG9kZXJhZG9BbHVtbm9UYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm9tYnJlIGRlIGxhIHRhYmxhIGRlIHJlbGFjacOzbiBBcG9kZXJhZG8tQWx1bW5vJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9mZXNvckN1cnNvVGFibGVOYW1lJywge1xyXG4gICAgICB2YWx1ZTogcHJvZmVzb3JDdXJzb1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdOb21icmUgZGUgbGEgdGFibGEgZGUgcmVsYWNpw7NuIFByb2Zlc29yLUN1cnNvJyxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=