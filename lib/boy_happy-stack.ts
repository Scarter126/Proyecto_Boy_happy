import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dotenv from 'dotenv';


dotenv.config({ path: './config.env' });


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
    const createLambda = (name: string, handlerFile: string, environment: Record<string, string> = {}) => {
      return new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${handlerFile}.handler`,
        code: lambda.Code.fromAsset('lambdas'),
        environment,
      });
    };

    // ----------------------------
    // Lambdas principales
    // ----------------------------
    const homeLambda = createLambda('HomeLambda', 'home');
    const alumnosLambda = createLambda('AlumnosLambda', 'alumnos');
    const profesoresLambda = createLambda('ProfesoresLambda', 'profesores');
    const adminLambda = createLambda('AdminLambda', 'admin');
    const fonoLambda = createLambda('FonoLambda', 'fono');

    // ----------------------------
    // Lambdas con S3
    // ----------------------------
    const imagesLambda = createLambda('ImagesLambda', 'images', {
      BUCKET_NAME: imagesBucket.bucketName,
    });
    imagesBucket.grantReadWrite(imagesLambda);

    const galeriaLambda = createLambda('GaleriaLambda', 'galeria', {
      BUCKET_NAME: imagesBucket.bucketName,
    });
    imagesBucket.grantRead(galeriaLambda);

    // ----------------------------
    // Lambdas con Dynamo
    // ----------------------------
    // Lambda de Anuncios (Commit 1.1.3)
    const anunciosLambda = createLambda('AnunciosLambda', 'anuncios', {
      ANUNCIOS_TABLE: anunciosTable.tableName,
    });
    anunciosTable.grantReadWriteData(anunciosLambda);

    // Lambda de Usuarios (Commit 1.2.3)
    const usuariosLambda = createLambda('UsuariosLambda', 'usuarios', {
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

    const eventosLambda = createLambda('EventosLambda', 'eventos', {
      TABLE_NAME: eventosTable.tableName,
      MATRICULAS_TABLE: matriculasTable.tableName,
    });
    eventosTable.grantReadWriteData(eventosLambda);
    matriculasTable.grantReadWriteData(eventosLambda);

    // Lambda de Notificaciones (Commit 1.3.4)
    const notificacionesLambda = createLambda('NotificacionesLambda', 'notificaciones', {
      USUARIOS_TABLE: usuariosTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    usuariosTable.grantReadData(notificacionesLambda);
    notificacionesLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    const tomaHoraLambda = createLambda('TomaHoraLambda', 'toma_hora');

    const reservarEvaluacionLambda = createLambda('ReservarEvaluacionLambda', 'reservar-evaluacion', {
      TABLE_NAME: evaluacionesTable.tableName,
    });
    evaluacionesTable.grantReadWriteData(reservarEvaluacionLambda);

    // ----------------------------
    // Lambdas Hosted UI / Callback
    // ----------------------------
    const crearUsuarioLambda = createLambda('CrearUsuarioLambda', 'crear_usuario', {
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


    const hostedLoginLambda = createLambda('HostedLoginLambda', 'login', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      CLIENT_SECRET: process.env.CLIENT_SECRET ?? '',
      REDIRECT_URI: process.env.REDIRECT_URI ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
    });

    const callbackLambda = createLambda('CallbackLambda', 'callback', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      CLIENT_SECRET: process.env.CLIENT_SECRET ?? '',
      REDIRECT_URI: process.env.REDIRECT_URI ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
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
