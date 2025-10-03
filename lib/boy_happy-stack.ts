import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dotenv from 'dotenv';


dotenv.config({ path: './.env' });


export class BoyHappyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------
    // Bucket de imágenes
    // ----------------------------
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: 'boyhappy-images-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ----------------------------
    // Tablas DynamoDB
    // ----------------------------
    // Tabla de Anuncios (Commit 1.1.1)
    const anunciosTable = new dynamodb.Table(this, 'AnunciosTable', {
      tableName: 'Anuncios',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // En producción usar RETAIN
    });

    // Tabla de Usuarios (Commit 1.2.1)
    const usuariosTable = new dynamodb.Table(this, 'UsuariosTable', {
      tableName: 'Usuarios',
      partitionKey: { name: 'rut', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // En producción usar RETAIN
    });

    // GSI para búsqueda por email
    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'correo', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const eventosTable = new dynamodb.Table(this, 'EventosTable', {
      tableName: 'Eventos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI para filtrar eventos por tipo y fecha (Commit 1.3.1)
    eventosTable.addGlobalSecondaryIndex({
      indexName: 'TipoIndex',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const evaluacionesTable = new dynamodb.Table(this, 'EvaluacionesTable', {
      tableName: 'EvaluacionesFonoaudiologia',
      partitionKey: { name: 'fechaHora', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Tabla de Matrículas (Commit 1.4.1)
    const matriculasTable = new dynamodb.Table(this, 'MatriculasTable', {
      tableName: 'Matriculas',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI para filtrar por estado de matrícula (pendiente/aprobada/rechazada)
    matriculasTable.addGlobalSecondaryIndex({
      indexName: 'EstadoIndex',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fechaRegistro', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ----------------------------
    // Helper para crear Lambdas
    // ----------------------------
    const createLambda = (name: string, handlerFile: string, handlerName: string = 'handler', environment: Record<string, string> = {}) => {
      return new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${handlerFile}.${handlerName}`,
        code: lambda.Code.fromAsset('.', {
          exclude: ['node_modules', 'cdk.out', 'test', '.git', 'docs', 'mock', '.claude', '*.md', '.env'],
          // templates/ se incluirá automáticamente
        }),
        environment,
      });
    };

    // ----------------------------
    // Frontend Lambdas (Sirven HTML) - Todos usan handlers.js
    // ----------------------------
    // Variables de entorno comunes para todas las lambdas frontend
    const frontendEnv = {
      CALLBACK_PREFIX: process.env.CALLBACK_PREFIX || '',
      CLIENT_ID: process.env.CLIENT_ID || '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN || '',
      API_URL: process.env.API_URL || '',
    };

    const homeLambda = createLambda('HomeLambda', 'lambdas/frontend/handlers', 'homeHandler', frontendEnv);
    const alumnosLambda = createLambda('AlumnosLambda', 'lambdas/frontend/handlers', 'alumnosHandler', frontendEnv);
    const profesoresLambda = createLambda('ProfesoresLambda', 'lambdas/frontend/handlers', 'profesoresHandler', frontendEnv);
    const adminLambda = createLambda('AdminLambda', 'lambdas/frontend/handlers', 'adminHandler', frontendEnv);
    const fonoLambda = createLambda('FonoLambda', 'lambdas/frontend/handlers', 'fonoHandler', frontendEnv);
    const tomaHoraLambda = createLambda('TomaHoraLambda', 'lambdas/frontend/handlers', 'tomaHoraHandler', frontendEnv);
    const galeriaLambda = createLambda('GaleriaLambda', 'lambdas/frontend/handlers', 'galeriaHandler', {
      BUCKET_NAME: imagesBucket.bucketName,
      ...frontendEnv,
    });
    imagesBucket.grantRead(galeriaLambda);

    // ----------------------------
    // Backend API Lambdas
    // ----------------------------
    // Lambda de Imágenes (S3)
    const imagesLambda = createLambda('ImagesLambda', 'lambdas/api/images', 'handler', {
      BUCKET_NAME: imagesBucket.bucketName,
    });
    imagesBucket.grantReadWrite(imagesLambda);

    // Lambda de Anuncios (DynamoDB)
    const anunciosLambda = createLambda('AnunciosLambda', 'lambdas/api/anuncios', 'handler', {
      ANUNCIOS_TABLE: anunciosTable.tableName,
    });
    anunciosTable.grantReadWriteData(anunciosLambda);

    // Lambda de Usuarios (DynamoDB + Cognito)
    const usuariosLambda = createLambda('UsuariosLambda', 'lambdas/api/usuarios', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
    });
    usuariosTable.grantReadWriteData(usuariosLambda);
    usuariosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup'
      ],
      resources: [
        `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`,
      ],
    }));

    // Lambda de Eventos (DynamoDB)
    const eventosLambda = createLambda('EventosLambda', 'lambdas/api/eventos', 'handler', {
      TABLE_NAME: eventosTable.tableName,
      MATRICULAS_TABLE: matriculasTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl', // Commit 1.4.5: Para notificaciones de matrícula
    });
    eventosTable.grantReadWriteData(eventosLambda);
    matriculasTable.grantReadWriteData(eventosLambda);
    // Commit 1.4.5: Permisos SES para enviar emails de notificación de matrícula
    eventosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Lambda de Notificaciones (SES)
    const notificacionesLambda = createLambda('NotificacionesLambda', 'lambdas/api/notificaciones', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    usuariosTable.grantReadData(notificacionesLambda);
    notificacionesLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Lambda de Reservar Evaluación (DynamoDB)
    const reservarEvaluacionLambda = createLambda('ReservarEvaluacionLambda', 'lambdas/api/reservar-evaluacion', 'handler', {
      TABLE_NAME: evaluacionesTable.tableName,
    });
    evaluacionesTable.grantReadWriteData(reservarEvaluacionLambda);

    // ----------------------------
    // Lambdas Hosted UI / Callback
    // ----------------------------
    const crearUsuarioLambda = createLambda('CrearUsuarioLambda', 'lambdas/api/crear_usuario', 'handler', {
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
    });

    // Añadir permisos solo para AdminCreateUser en el User Pool específico
    crearUsuarioLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
      ],
      resources: [
        `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`,
      ],
    }));


    const hostedLoginLambda = createLambda('HostedLoginLambda', 'lambdas/api/login', 'handler', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
      API_URL: process.env.API_URL ?? '',
      CALLBACK_PREFIX: process.env.CALLBACK_PREFIX || '',
    });

    const callbackLambda = createLambda('CallbackLambda', 'lambdas/api/callback', 'handler', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      CLIENT_SECRET: process.env.CLIENT_SECRET ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
      CALLBACK_PREFIX: process.env.CALLBACK_PREFIX || '',
    });

    // ----------------------------
    // API Gateway
    // ----------------------------
    const api = new apigateway.RestApi(this, 'BoyHappyApi', {
      restApiName: 'BoyHappy Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type'],
      },
    });

    // --- Rutas de anuncios (Commit 1.1.3) ---
    const anuncios = api.root.addResource('anuncios');
    anuncios.addMethod('POST', new apigateway.LambdaIntegration(anunciosLambda));
    anuncios.addMethod('GET', new apigateway.LambdaIntegration(anunciosLambda));
    anuncios.addMethod('DELETE', new apigateway.LambdaIntegration(anunciosLambda));

    // --- Rutas de usuarios (Commit 1.2.3) ---
    const usuarios = api.root.addResource('usuarios');
    usuarios.addMethod('POST', new apigateway.LambdaIntegration(usuariosLambda));
    usuarios.addMethod('GET', new apigateway.LambdaIntegration(usuariosLambda));
    usuarios.addMethod('PUT', new apigateway.LambdaIntegration(usuariosLambda));
    usuarios.addMethod('DELETE', new apigateway.LambdaIntegration(usuariosLambda));

    // --- Rutas de eventos ---
    const eventos = api.root.addResource('eventos');
    eventos.addMethod('POST', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('GET', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('DELETE', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('PUT', new apigateway.LambdaIntegration(eventosLambda));

    // --- Rutas de notificaciones (Commit 1.3.4) ---
    const notificaciones = api.root.addResource('notificaciones');
    notificaciones.addMethod('POST', new apigateway.LambdaIntegration(notificacionesLambda));

    // --- Rutas de matrículas (Commit 1.4.3) ---
    const matriculas = api.root.addResource('matriculas');
    matriculas.addMethod('POST', new apigateway.LambdaIntegration(eventosLambda));
    matriculas.addMethod('GET', new apigateway.LambdaIntegration(eventosLambda));
    matriculas.addMethod('PUT', new apigateway.LambdaIntegration(eventosLambda));

    // --- Rutas fonoaudiología ---
    const tomaHora = api.root.addResource('toma-hora');
    tomaHora.addMethod('GET', new apigateway.LambdaIntegration(tomaHoraLambda));

    const reservarEvaluacion = api.root.addResource('reservar-evaluacion');
    reservarEvaluacion.addMethod('GET', new apigateway.LambdaIntegration(reservarEvaluacionLambda));
    reservarEvaluacion.addMethod('POST', new apigateway.LambdaIntegration(reservarEvaluacionLambda));
    reservarEvaluacion.addMethod('DELETE', new apigateway.LambdaIntegration(reservarEvaluacionLambda));

    // --- Rutas generales ---
    api.root.addMethod('GET', new apigateway.LambdaIntegration(homeLambda));

    const imagenes = api.root.addResource('imagenes');
    imagenes.addMethod('POST', new apigateway.LambdaIntegration(imagesLambda));
    imagenes.addMethod('GET', new apigateway.LambdaIntegration(imagesLambda));

    const galeria = api.root.addResource('galeria');
    galeria.addMethod('GET', new apigateway.LambdaIntegration(galeriaLambda));

    // --- Rutas de login Hosted UI ---
    const login = api.root.addResource('login');
    login.addMethod('GET', new apigateway.LambdaIntegration(hostedLoginLambda));

    const callback = api.root.addResource('callback');
    callback.addMethod('GET', new apigateway.LambdaIntegration(callbackLambda));

    const crearUsuario = api.root.addResource('crear-usuario');
    crearUsuario.addMethod('POST', new apigateway.LambdaIntegration(crearUsuarioLambda));


    // --- Rutas de páginas según rol ---
    login.addResource('admin').addMethod('GET', new apigateway.LambdaIntegration(adminLambda));
    login.addResource('profesores').addMethod('GET', new apigateway.LambdaIntegration(profesoresLambda));
    login.addResource('alumnos').addMethod('GET', new apigateway.LambdaIntegration(alumnosLambda));
    login.addResource('fono').addMethod('GET', new apigateway.LambdaIntegration(fonoLambda));

    // ----------------------------
    // Outputs
    // ----------------------------
    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: imagesBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: api.url ?? 'No URL created',
    });

    new cdk.CfnOutput(this, 'AnunciosTableName', {
      value: anunciosTable.tableName,
      description: 'Nombre de la tabla de Anuncios',
    });

    new cdk.CfnOutput(this, 'UsuariosTableName', {
      value: usuariosTable.tableName,
      description: 'Nombre de la tabla de Usuarios',
    });
  }
}
