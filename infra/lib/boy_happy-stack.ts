import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: './.env' });

// Importar constantes de nombres de tablas (única fuente de verdad)
const TABLE_NAMES = require('../../shared/table-names.cjs');

// ==========================================
// TIPOS PARA AUTO-DISCOVERY DE LAMBDAS
// ==========================================

interface LambdaMetadata {
  route: string;
  methods?: string[];
  auth?: boolean;
  authExceptions?: Record<string, boolean>;
  roles?: string[];
  profile?: 'light' | 'medium' | 'heavy';
  tables?: string[];
  buckets?: string[];
  additionalPolicies?: Array<{
    actions: string[];
    resources: string[];
  }>;
}

interface DiscoveredLambda {
  name: string;              // Nombre del archivo sin .js
  fileName: string;          // Nombre completo del archivo
  filePath: string;          // Ruta absoluta al archivo
  metadata: LambdaMetadata;  // Metadata exportada
}

// ==========================================
// FUNCIÓN: AUTO-DISCOVERY DE LAMBDAS
// ==========================================

/**
 * Descubre automáticamente todas las lambdas en el directorio especificado
 * y extrae su metadata para auto-configuración
 */
function discoverLambdas(lambdaDir: string): DiscoveredLambda[] {
  const absolutePath = path.resolve(__dirname, lambdaDir);

  console.log(`\n🔍 Discovering lambdas in: ${absolutePath}`);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  Lambda directory not found: ${absolutePath}`);
    return [];
  }

  const files = fs.readdirSync(absolutePath)
    .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.'));

  console.log(`📦 Found ${files.length} lambda files`);

  const discovered: DiscoveredLambda[] = [];

  for (const file of files) {
    const name = file.replace('.js', '');
    const filePath = path.join(absolutePath, file);

    try {
      // Intentar cargar el módulo para leer metadata
      // NOTA: En tiempo de CDK synth, esto requiere que los módulos sean válidos
      // Si hay errores de require (faltan deps), usamos metadata por defecto
      delete require.cache[require.resolve(filePath)];
      const module = require(filePath);

      const metadata: LambdaMetadata = module.metadata || {
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

    } catch (error: any) {
      console.warn(`  ⚠️  Could not load metadata for ${file}:`, error.message);

      // Usar metadata por defecto si no se puede cargar
      const defaultMetadata: LambdaMetadata = {
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

export class BoyHappyStack extends cdk.Stack {
  private usuariosLambda?: lambda.Function;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
      readCapacity: 5,  // FREE TIER: 25 RCU totales compartidas entre todas las tablas
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

    // ----------------------------
    // Helper para crear Lambdas con configuración optimizada
    // ----------------------------
    interface LambdaConfig {
      memory?: number;
      timeout?: number;
      concurrency?: number;
    }

    const LAMBDA_PROFILES = {
      light: { memory: 256, timeout: 10 },    // Auth, callbacks
      medium: { memory: 512, timeout: 15 },   // CRUD operations
      heavy: { memory: 1024, timeout: 30 },   // Reportes, S3, backups
    };

    const createLambda = (
      name: string,
      handlerFile: string,
      handlerName: string = 'handler',
      environment: Record<string, string> = {},
      config: LambdaConfig = LAMBDA_PROFILES.medium
    ) => {
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
          'http://localhost:3005',     // Frontend dev server (Vite default)
          'http://127.0.0.1:3005',
          'http://localhost:3000',     // Fallback dev port
          'http://127.0.0.1:3000',
          frontendBucket.bucketWebsiteUrl  // S3 Static Website URL (producción)
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
    const tablesMap = new Map<string, dynamodb.Table>([
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

    const bucketsMap = new Map<string, s3.Bucket>([
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
    const autoGrantPermissions = (
      lambdaFunction: lambda.Function,
      metadata: LambdaMetadata
    ) => {
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
            } else if (accessType === 'write') {
              table.grantWriteData(lambdaFunction);
              console.log(`    ✍️  Granted WRITE on ${tableName}`);
            } else {
              table.grantReadWriteData(lambdaFunction);
              console.log(`    📝 Granted READ/WRITE on ${tableName}`);
            }
          } else {
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
            } else if (permission === 'readonly') {
              bucket.grantRead(lambdaFunction);
              console.log(`    📦 Granted readonly access to bucket: ${bucketName}`);
            }
          } else {
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
    const frontendServerLambda = null as any;

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
    const autoLambdas = new Map<string, lambda.Function>();
    const autoRouteMap: Record<string, lambda.Function> = {};

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
      const environment: Record<string, string> = {};

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
          const [envKey] = tableSpec.split(':');  // Ej: 'AGENDA_TABLE'
          const table = tablesMap.get(envKey);
          if (table) {
            // Directamente: AGENDA_TABLE = 'AgendaFonoaudiologia'
            environment[envKey] = table.tableName;
          } else {
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
      const lambdaFunction = createLambda(
        `${name.charAt(0).toUpperCase() + name.slice(1)}Lambda`,
        `api/${name}`,
        'handler',
        environment,
        profile
      );

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
    const routeMap: Record<string, lambda.Function> = autoRouteMap;

    // Lambda Router centralizado
    const apiRouterLambda = new lambda.Function(this, 'ApiRouterLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const lambdaClient = new LambdaClient({});

const ROUTE_MAP = ${JSON.stringify(
        Object.fromEntries(
          Object.entries(routeMap).map(([route, fn]) => [route, fn.functionName])
        )
      )};

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
