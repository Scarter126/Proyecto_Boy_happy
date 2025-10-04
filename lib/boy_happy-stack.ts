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
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env' });

export class BoyHappyStack extends cdk.Stack {
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
    const backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
      bucketName: `boyhappy-backups-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // RETAIN para no perder backups
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // Versionado para mayor seguridad
      lifecycleRules: [{
        // Retener solo 30 días de backups (gestión en lambda, esto es por seguridad)
        expiration: cdk.Duration.days(60),
        noncurrentVersionExpiration: cdk.Duration.days(30)
      }]
    });

    // ----------------------------
    // TABLAS DYNAMODB OPTIMIZADAS
    // ----------------------------

    // 1. TABLA USUARIOS (sin cambios)
    const usuariosTable = new dynamodb.Table(this, 'UsuariosTable', {
      tableName: 'Usuarios',
      partitionKey: { name: 'rut', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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

    // 3. TABLA ASISTENCIA (sin cambios - ya optimizada)
    const asistenciaTable = new dynamodb.Table(this, 'AsistenciaTable', {
      tableName: 'Asistencia',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 7. TABLA CONFIGURACION (sin cambios - mantenemos DynamoDB)
    const configuracionTable = new dynamodb.Table(this, 'ConfiguracionTable', {
      tableName: 'Configuracion',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 8. TABLA INFORMES (NUEVA - FASE 5)
    const informesTable = new dynamodb.Table(this, 'InformesTable', {
      tableName: 'Informes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    reportesTable.addGlobalSecondaryIndex({
      indexName: 'TipoIndex',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fechaGeneracion', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ----------------------------
    // Lambda Layer con dependencias comunes
    // ----------------------------
    const commonLayer = new lambda.LayerVersion(this, 'CommonDependenciesLayer', {
      code: lambda.Code.fromAsset('src/layers/common'),
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
        code: lambda.Code.fromAsset('src', {
          exclude: [
            'layers/**',
            '*.md',
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
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
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
    // LAMBDAS OPTIMIZADAS - Usar apiUrl construida dinámicamente
    // ----------------------------

    // Page Router Lambda (frontend)
    const pageRouterLambda = createLambda('PageRouterLambda', 'front/page-router', 'handler', {
      API_URL: apiUrl,
      CLIENT_ID: process.env.CLIENT_ID || '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN || '',
    }, LAMBDA_PROFILES.light);

    // Auth Lambdas
    const hostedLoginLambda = createLambda('HostedLoginLambda', 'api/login', 'handler', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
      API_URL: apiUrl,
    }, LAMBDA_PROFILES.light);

    const callbackLambda = createLambda('CallbackLambda', 'api/callback', 'handler', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      CLIENT_SECRET: process.env.CLIENT_SECRET ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
    }, LAMBDA_PROFILES.light);

    // Lambda de Usuarios
    const usuariosLambda = createLambda('UsuariosLambda', 'api/usuarios', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
    });
    usuariosTable.grantReadWriteData(usuariosLambda);
    usuariosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup'
      ],
      resources: [
        `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`,
      ],
    }));

    // Lambda de Profesionales (PÚBLICO - sin autenticación)
    const profesionalesLambda = createLambda('ProfesionalesLambda', 'api/profesionales', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
    }, LAMBDA_PROFILES.light);
    usuariosTable.grantReadData(profesionalesLambda);

    // Lambda de Anuncios
    const anunciosLambda = createLambda('AnunciosLambda', 'api/anuncios', 'handler', {
      ANUNCIOS_TABLE: comunicacionesTable.tableName,
    });
    comunicacionesTable.grantReadWriteData(anunciosLambda);

    // Lambda de Eventos
    const eventosLambda = createLambda('EventosLambda', 'api/eventos', 'handler', {
      EVENTOS_TABLE: comunicacionesTable.tableName,
    });
    comunicacionesTable.grantReadWriteData(eventosLambda);

    // Lambda de Asistencia
    const asistenciaLambda = createLambda('AsistenciaLambda', 'api/asistencia', 'handler', {
      ASISTENCIA_TABLE: asistenciaTable.tableName,
    });
    asistenciaTable.grantReadWriteData(asistenciaLambda);

    // Lambda de Notificaciones
    const notificacionesLambda = createLambda('NotificacionesLambda', 'api/notificaciones', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    usuariosTable.grantReadData(notificacionesLambda);
    notificacionesLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Lambda de Imágenes (S3)
    const imagesLambda = createLambda('ImagesLambda', 'api/images', 'handler', {
      BUCKET_NAME: imagesBucket.bucketName,
    }, LAMBDA_PROFILES.heavy);
    imagesBucket.grantReadWrite(imagesLambda);

    // Lambda de Reservar Evaluación (Fono)
    const reservarEvaluacionLambda = createLambda('ReservarEvaluacionLambda', 'api/reservar-evaluacion', 'handler', {
      AGENDA_TABLE: agendaFonoTable.tableName,
    });
    agendaFonoTable.grantReadWriteData(reservarEvaluacionLambda);

    // Lambda de Notas (FASE 1)
    const notasLambda = createLambda('NotasLambda', 'api/notas', 'handler', {
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
    });
    recursosAcademicosTable.grantReadWriteData(notasLambda);

    // Lambda de Materiales (FASE 2)
    const materialesLambda = createLambda('MaterialesLambda', 'api/materiales', 'handler', {
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
      MATERIALES_BUCKET: materialesBucket.bucketName,
    }, LAMBDA_PROFILES.heavy);
    recursosAcademicosTable.grantReadWriteData(materialesLambda);
    materialesBucket.grantReadWrite(materialesLambda);

    // Lambda de Bitácora (FASE 3)
    const bitacoraLambda = createLambda('BitacoraLambda', 'api/bitacora', 'handler', {
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
    });
    recursosAcademicosTable.grantReadWriteData(bitacoraLambda);

    // Lambda de Categorías (FASE 4)
    const categoriasLambda = createLambda('CategoriasLambda', 'api/categorias', 'handler', {
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
    }, LAMBDA_PROFILES.light);
    recursosAcademicosTable.grantReadWriteData(categoriasLambda);

    // Lambda de Informes (FASE 5)
    const informesLambda = createLambda('InformesLambda', 'api/informes', 'handler', {
      INFORMES_TABLE: informesTable.tableName,
      MATERIALES_BUCKET: materialesBucket.bucketName,
    }, LAMBDA_PROFILES.heavy);
    informesTable.grantReadWriteData(informesLambda);
    materialesBucket.grantReadWrite(informesLambda);

    // Lambda de Sesiones Terapéuticas (FASE 6)
    const sesionesLambda = createLambda('SesionesLambda', 'api/sesiones', 'handler', {
      AGENDA_TABLE: agendaFonoTable.tableName,
      MATERIALES_BUCKET: materialesBucket.bucketName,
    });
    agendaFonoTable.grantReadWriteData(sesionesLambda);
    materialesBucket.grantReadWrite(sesionesLambda);

    // Lambda de Bitácora Fonoaudióloga (FASE 6B - CU-45)
    const bitacoraFonoLambda = createLambda('BitacoraFonoLambda', 'api/bitacora-fono', 'handler', {
      AGENDA_TABLE: agendaFonoTable.tableName,
    });
    agendaFonoTable.grantReadWriteData(bitacoraFonoLambda);

    // Lambda de Retroalimentación (FASE 7)
    const retroalimentacionLambda = createLambda('RetroalimentacionLambda', 'api/retroalimentacion', 'handler', {
      RETROALIMENTACION_TABLE: retroalimentacionTable.tableName,
    });
    retroalimentacionTable.grantReadWriteData(retroalimentacionLambda);

    // Lambda de Configuración (FASE 8)
    const configuracionLambda = createLambda('ConfiguracionLambda', 'api/configuracion', 'handler', {
      CONFIGURACION_TABLE: configuracionTable.tableName,
    }, LAMBDA_PROFILES.light);
    configuracionTable.grantReadWriteData(configuracionLambda);

    // Lambda de Reportes (FASE 9)
    const reportesLambda = createLambda('ReportesLambda', 'api/reportes', 'handler', {
      REPORTES_TABLE: reportesTable.tableName,
      ASISTENCIA_TABLE: asistenciaTable.tableName,
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
      USUARIOS_TABLE: usuariosTable.tableName,
    }, LAMBDA_PROFILES.heavy);
    reportesTable.grantReadWriteData(reportesLambda);
    asistenciaTable.grantReadData(reportesLambda);
    recursosAcademicosTable.grantReadData(reportesLambda);
    usuariosTable.grantReadData(reportesLambda);

    // Lambda de Matrículas (FASE 10 - separado de eventos)
    const matriculasLambda = createLambda('MatriculasLambda', 'api/matriculas', 'handler', {
      COMUNICACIONES_TABLE: comunicacionesTable.tableName,
      USUARIOS_TABLE: usuariosTable.tableName,
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    comunicacionesTable.grantReadWriteData(matriculasLambda);
    usuariosTable.grantReadWriteData(matriculasLambda);
    matriculasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));
    matriculasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup'
      ],
      resources: [
        `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`,
      ],
    }));

    // Lambda de Backups (CU-12)
    const backupLambda = createLambda('BackupLambda', 'api/backup', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      COMUNICACIONES_TABLE: comunicacionesTable.tableName,
      ASISTENCIA_TABLE: asistenciaTable.tableName,
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
      RETROALIMENTACION_TABLE: retroalimentacionTable.tableName,
      AGENDA_TABLE: agendaFonoTable.tableName,
      CONFIGURACION_TABLE: configuracionTable.tableName,
      INFORMES_TABLE: informesTable.tableName,
      REPORTES_TABLE: reportesTable.tableName,
      BACKUP_BUCKET: backupsBucket.bucketName,
    }, LAMBDA_PROFILES.heavy);

    // Permisos para backup
    usuariosTable.grantReadData(backupLambda);
    comunicacionesTable.grantReadData(backupLambda);
    asistenciaTable.grantReadData(backupLambda);
    recursosAcademicosTable.grantReadData(backupLambda);
    retroalimentacionTable.grantReadData(backupLambda);
    agendaFonoTable.grantReadData(backupLambda);
    configuracionTable.grantReadWriteData(backupLambda); // Write para registrar último backup
    informesTable.grantReadData(backupLambda);
    reportesTable.grantReadData(backupLambda);
    backupsBucket.grantReadWrite(backupLambda);

    // Lambda de Exportar Reportes (CU-25)
    const exportarReportesLambda = createLambda('ExportarReportesLambda', 'api/exportar-reportes', 'handler', {
      ASISTENCIA_TABLE: asistenciaTable.tableName,
      RECURSOS_TABLE: recursosAcademicosTable.tableName,
      USUARIOS_TABLE: usuariosTable.tableName,
    }, LAMBDA_PROFILES.heavy);
    asistenciaTable.grantReadData(exportarReportesLambda);
    recursosAcademicosTable.grantReadData(exportarReportesLambda);
    usuariosTable.grantReadData(exportarReportesLambda);

    // EventBridge Rule para backups diarios a las 2 AM Chile
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

    // ----------------------------
    // CONFIGURACIÓN DE ROUTING EN API GATEWAY
    // ----------------------------
    // Mapa de rutas a Lambdas para routing centralizado
    const routeMap: Record<string, lambda.Function> = {
      '/login': hostedLoginLambda,
      '/callback': callbackLambda,
      '/usuarios': usuariosLambda,
      '/profesionales': profesionalesLambda,
      '/anuncios': anunciosLambda,
      '/eventos': eventosLambda,
      '/asistencia': asistenciaLambda,
      '/notificaciones': notificacionesLambda,
      '/reservar-evaluacion': reservarEvaluacionLambda,
      '/imagenes': imagesLambda,
      '/notas': notasLambda,
      '/materiales': materialesLambda,
      '/bitacora': bitacoraLambda,
      '/categorias': categoriasLambda,
      '/informes': informesLambda,
      '/sesiones': sesionesLambda,
      '/archivos-sesion': sesionesLambda,
      '/bitacora-fono': bitacoraFonoLambda,
      '/informes-fono': informesLambda,
      '/agenda-fono': reservarEvaluacionLambda,
      '/retroalimentacion': retroalimentacionLambda,
      '/configuracion': configuracionLambda,
      '/reportes': reportesLambda,
      '/matriculas': matriculasLambda,
      '/backup': backupLambda,
      '/exportar': exportarReportesLambda,
      // Páginas frontend
      '/admin': pageRouterLambda,
      '/profesores': pageRouterLambda,
      '/alumnos': pageRouterLambda,
      '/fono': pageRouterLambda,
      '/galeria': pageRouterLambda,
      '/toma-hora': pageRouterLambda,
    };

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

exports.handler = async (event) => {
  console.log('Router received event:', JSON.stringify(event, null, 2));

  const path = event.path || '/';
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

  // Home page
  if (path === '/') targetLambda = '${pageRouterLambda.functionName}';

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

    // Proxy único que captura todas las rutas
    const proxy = api.root.addResource('{proxy+}');
    proxy.addMethod('ANY', new apigateway.LambdaIntegration(apiRouterLambda));

    // Root para home
    api.root.addMethod('GET', new apigateway.LambdaIntegration(pageRouterLambda));

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

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: api.url,
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
  }
}
