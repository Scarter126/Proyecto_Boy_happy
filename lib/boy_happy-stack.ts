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
    // Buckets S3
    // ----------------------------
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: 'boyhappy-images-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const eduBucket = new s3.Bucket(this, 'EduBucket', {
      bucketName: 'boyhappy-edu-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ----------------------------
    // Tablas DynamoDB
    // ----------------------------
    const eventosTable = new dynamodb.Table(this, 'EventosTable', {
      tableName: 'Eventos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const evaluacionesTable = new dynamodb.Table(this, 'EvaluacionesTable', {
      tableName: 'EvaluacionesFonoaudiologia',
      partitionKey: { name: 'fechaHora', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const cursosTable = new dynamodb.Table(this, 'CursosTable', {
      tableName: 'Cursos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const asistenciasTable = new dynamodb.Table(this, 'AsistenciasTable', {
      tableName: 'Asistencias',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----------------------------
    // Helper para crear Lambdas
    // ----------------------------
    const createLambda = (name: string, handlerFile: string, environment: Record<string, string> = {}) => {
      return new lambda.Function(this, `${name}Lambda`, {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${handlerFile}.handler`,
        code: lambda.Code.fromAsset('lambdas'),
        environment,
      });
    };

    const createS3Lambda = (name: string, handlerFile: string, bucket: s3.Bucket) => {
      const l = createLambda(name, handlerFile, { BUCKET_NAME: bucket.bucketName });
      bucket.grantReadWrite(l);
      return l;
    };

    const createDynamoLambda = (name: string, handlerFile: string, table: dynamodb.Table) => {
      const l = createLambda(name, handlerFile, { TABLE_NAME: table.tableName });
      table.grantReadWriteData(l);
      return l;
    };

    // ----------------------------
    // Lambdas principales
    // ----------------------------
    const homeLambda = createLambda('Home', 'home');
    const alumnosLambda = createLambda('Alumnos', 'alumnos');
    const profesoresLambda = createLambda('Profesores', 'profesores');
    const adminLambda = createLambda('Admin', 'admin');
    const fonoLambda = createLambda('Fono', 'fono');

    // ----------------------------
    // Lambdas con S3 (imagenes)
    // ----------------------------
    const imagesLambda = createS3Lambda('Images', 'images', imagesBucket);
    const galeriaLambda = createS3Lambda('Galeria', 'galeria', imagesBucket);

    // ----------------------------
    // Lambdas con Dynamo (eventos y evaluaciones)
    // ----------------------------
    const eventosLambda = createDynamoLambda('Eventos', 'eventos', eventosTable);
    const tomarHoraLambda = createLambda('TomaHora', 'toma_hora');
    const reservarEvaluacionLambda = createDynamoLambda('ReservarEvaluacion', 'reservar-evaluacion', evaluacionesTable);

    // ----------------------------
    // Lambdas educativos
    // ----------------------------
    const cursoLambda = createDynamoLambda('Curso', 'curso', cursosTable);
    const asistenciaLambda = createDynamoLambda('Asistencia', 'asistencia', asistenciasTable);
    const contenidoEducativoLambda = createS3Lambda('ContenidoEducativo', 'contenido_educativo', eduBucket);

    // ----------------------------
    // Lambda de usuarios (crear, editar, eliminar)
    // ----------------------------
    const crearUsuarioLambda = createLambda('CrearUsuario', 'crear_usuario', {
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
    });
    crearUsuarioLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminDeleteUser'
      ],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`],
    }));

    // ----------------------------
    // Lambdas Hosted UI / Callback
    // ----------------------------
    const hostedLoginLambda = createLambda('HostedLogin', 'login', {
      CLIENT_ID: process.env.CLIENT_ID ?? '',
      CLIENT_SECRET: process.env.CLIENT_SECRET ?? '',
      REDIRECT_URI: process.env.REDIRECT_URI ?? '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
    });

    const callbackLambda = createLambda('Callback', 'callback', {
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

    // --- Rutas educativas ---
    const educativoResource = api.root.addResource('educativo');

    const cursosResource = educativoResource.addResource('cursos');
    cursosResource.addMethod('POST', new apigateway.LambdaIntegration(cursoLambda));
    cursosResource.addMethod('PUT', new apigateway.LambdaIntegration(cursoLambda));
    cursosResource.addMethod('DELETE', new apigateway.LambdaIntegration(cursoLambda));
    cursosResource.addMethod('GET', new apigateway.LambdaIntegration(cursoLambda));

    const asistenciasResource = educativoResource.addResource('asistencias');
    asistenciasResource.addMethod('POST', new apigateway.LambdaIntegration(asistenciaLambda));
    asistenciasResource.addMethod('PUT', new apigateway.LambdaIntegration(asistenciaLambda));
    asistenciasResource.addMethod('DELETE', new apigateway.LambdaIntegration(asistenciaLambda));
    asistenciasResource.addMethod('GET', new apigateway.LambdaIntegration(asistenciaLambda));

    const contenidoResource = educativoResource.addResource('contenido');
    contenidoResource.addMethod('POST', new apigateway.LambdaIntegration(contenidoEducativoLambda));
    contenidoResource.addMethod('PUT', new apigateway.LambdaIntegration(contenidoEducativoLambda));
    contenidoResource.addMethod('DELETE', new apigateway.LambdaIntegration(contenidoEducativoLambda));
    contenidoResource.addMethod('GET', new apigateway.LambdaIntegration(contenidoEducativoLambda));

    // --- Rutas de eventos ---
    const eventosResource = api.root.addResource('eventos');
    eventosResource.addMethod('POST', new apigateway.LambdaIntegration(eventosLambda));
    eventosResource.addMethod('GET', new apigateway.LambdaIntegration(eventosLambda));
    eventosResource.addMethod('DELETE', new apigateway.LambdaIntegration(eventosLambda));
    eventosResource.addMethod('PUT', new apigateway.LambdaIntegration(eventosLambda));

    // --- Rutas fonoaudiología ---
    const tomaHoraResource = api.root.addResource('toma-hora');
    tomaHoraResource.addMethod('GET', new apigateway.LambdaIntegration(tomarHoraLambda));

    const reservarEvaluacionResource = api.root.addResource('reservar-evaluacion');
    reservarEvaluacionResource.addMethod('GET', new apigateway.LambdaIntegration(reservarEvaluacionLambda));
    reservarEvaluacionResource.addMethod('POST', new apigateway.LambdaIntegration(reservarEvaluacionLambda));
    reservarEvaluacionResource.addMethod('DELETE', new apigateway.LambdaIntegration(reservarEvaluacionLambda));

    // --- Rutas generales ---
    api.root.addMethod('GET', new apigateway.LambdaIntegration(homeLambda));

    const imagenesResource = api.root.addResource('imagenes');
    imagenesResource.addMethod('POST', new apigateway.LambdaIntegration(imagesLambda));
    imagenesResource.addMethod('GET', new apigateway.LambdaIntegration(imagesLambda));

    const galeriaResource = api.root.addResource('galeria');
    galeriaResource.addMethod('GET', new apigateway.LambdaIntegration(galeriaLambda));

    // --- Rutas de login Hosted UI ---
    const loginResource = api.root.addResource('login');
    loginResource.addMethod('GET', new apigateway.LambdaIntegration(hostedLoginLambda));

    const callbackResource = api.root.addResource('callback');
    callbackResource.addMethod('GET', new apigateway.LambdaIntegration(callbackLambda));

    // --- Rutas de usuarios ---
    const usuarioResource = api.root.addResource('crear-usuario');
    usuarioResource.addMethod('POST', new apigateway.LambdaIntegration(crearUsuarioLambda));
    usuarioResource.addMethod('PUT', new apigateway.LambdaIntegration(crearUsuarioLambda));
    usuarioResource.addMethod('DELETE', new apigateway.LambdaIntegration(crearUsuarioLambda));

    // --- Rutas de páginas según rol ---
    loginResource.addResource('admin').addMethod('GET', new apigateway.LambdaIntegration(adminLambda));
    loginResource.addResource('profesores').addMethod('GET', new apigateway.LambdaIntegration(profesoresLambda));
    loginResource.addResource('alumnos').addMethod('GET', new apigateway.LambdaIntegration(alumnosLambda));
    loginResource.addResource('fono').addMethod('GET', new apigateway.LambdaIntegration(fonoLambda));

    // ----------------------------
    // Outputs
    // ----------------------------
    new cdk.CfnOutput(this, 'ImagesBucketName', { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, 'EduBucketName', { value: eduBucket.bucketName });
    new cdk.CfnOutput(this, 'WebsiteURL', { value: api.url ?? 'No URL created' });
  }
}

//Hacer el envio de correos. agendar hora, asistencia critica, creacion de usuario, avisos y subida de informes