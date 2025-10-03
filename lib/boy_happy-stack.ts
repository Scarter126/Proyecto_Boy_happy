import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
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

    const eduBucket = new s3.Bucket(this, 'EduBucket', {
      bucketName: `boyhappy-edu-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ----------------------------
    // Tablas DynamoDB
    // ----------------------------
    const anunciosTable = new dynamodb.Table(this, 'AnunciosTable', {
      tableName: 'Anuncios',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    const eventosTable = new dynamodb.Table(this, 'EventosTable', {
      tableName: 'Eventos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    const cursosTable = new dynamodb.Table(this, 'CursosTable', {
      tableName: 'Cursos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    // ----------------------------
    // Helper para crear Lambdas
    // ----------------------------
    const createLambda = (
      name: string,
      handlerFile: string,
      handlerName: string = 'handler',
      environment: Record<string, string> = {}
    ) => {
      const relativeHandler = handlerFile.startsWith('lambdas/')
        ? handlerFile.substring('lambdas/'.length)
        : handlerFile;

      return new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${relativeHandler}.${handlerName}`,
        code: lambda.Code.fromAsset('lambdas'),
        environment: {
          ...environment,
          LAST_DEPLOY: new Date().toISOString(),
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
      });
    };

    const frontendEnv = {
      CALLBACK_PREFIX: process.env.CALLBACK_PREFIX || '',
      CLIENT_ID: process.env.CLIENT_ID || '',
      COGNITO_DOMAIN: process.env.COGNITO_DOMAIN || '',
      API_URL: process.env.API_URL || '',
    };

    // ----------------------------
    // Lambdas Frontend
    // ----------------------------
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
    // Lambdas Backend
    // ----------------------------
    const imagesLambda = createLambda('ImagesLambda', 'lambdas/api/images', 'handler', {
      BUCKET_NAME: imagesBucket.bucketName,
    });
    imagesBucket.grantReadWrite(imagesLambda);

    const contenidoEducativoLambda = createLambda('ContenidoEducativoLambda', 'lambdas/api/contenido_educativo', 'handler', {
      BUCKET_NAME: eduBucket.bucketName,
    });
    eduBucket.grantReadWrite(contenidoEducativoLambda);

    const anunciosLambda = createLambda('AnunciosLambda', 'lambdas/api/anuncios', 'handler', {
      ANUNCIOS_TABLE: anunciosTable.tableName,
    });
    anunciosTable.grantReadWriteData(anunciosLambda);

    const usuariosLambda = createLambda('UsuariosLambda', 'lambdas/api/usuarios', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      USER_POOL_ID: process.env.USER_POOL_ID ?? '',
    });
    usuariosTable.grantReadWriteData(usuariosLambda);
    usuariosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
      ],
      resources: [
        `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${process.env.USER_POOL_ID}`,
      ],
    }));

    const eventosLambda = createLambda('EventosLambda', 'lambdas/api/eventos', 'handler', {
      TABLE_NAME: eventosTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    eventosTable.grantReadWriteData(eventosLambda);

    const notificacionesLambda = createLambda('NotificacionesLambda', 'lambdas/api/notificaciones', 'handler', {
      USUARIOS_TABLE: usuariosTable.tableName,
      SOURCE_EMAIL: 'noreply@boyhappy.cl',
    });
    usuariosTable.grantReadData(notificacionesLambda);

    const evaluacionesLambda = createLambda('EvaluacionesLambda', 'lambdas/api/evaluaciones', 'handler', {
      TABLE_NAME: evaluacionesTable.tableName,
    });
    evaluacionesTable.grantReadWriteData(evaluacionesLambda);

    const cursoLambda = createLambda('CursoLambda', 'lambdas/api/curso', 'handler', {
      TABLE_NAME: cursosTable.tableName,
    });
    cursosTable.grantReadWriteData(cursoLambda);

    const asistenciaLambda = createLambda('AsistenciaLambda', 'lambdas/api/asistencia', 'handler', {
      TABLE_NAME: asistenciaTable.tableName,
    });
    asistenciaTable.grantReadWriteData(asistenciaLambda);

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

    const addLambdaRoute = (resource: apigateway.Resource, method: string, lambdaFn: lambda.IFunction) => {
      resource.addMethod(method, new apigateway.LambdaIntegration(lambdaFn));
    };

    // --- Home
    api.root.addMethod('GET', new apigateway.LambdaIntegration(homeLambda));

    // --- /imagenes
    const imagenesResource = api.root.addResource('imagenes');
    ['GET', 'POST'].forEach(method => addLambdaRoute(imagenesResource, method, imagesLambda));

    // --- /galeria
    const galeriaResource = api.root.addResource('galeria');
    addLambdaRoute(galeriaResource, 'GET', galeriaLambda);

    // --- /usuarios
    const usuariosResource = api.root.addResource('usuarios');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(usuariosResource, method, usuariosLambda));

    // --- /eventos
    const eventosResource = api.root.addResource('eventos');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(eventosResource, method, eventosLambda));

    // --- /evaluaciones
    const evaluacionesResource = api.root.addResource('evaluaciones');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(evaluacionesResource, method, evaluacionesLambda));

    // --- /notificaciones
    const notificacionesResource = api.root.addResource('notificaciones');
    ['POST'].forEach(method => addLambdaRoute(notificacionesResource, method, notificacionesLambda));

    // --- /educativo
    const educativoResource = api.root.addResource('educativo');

    const cursosResource = educativoResource.addResource('cursos');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(cursosResource, method, cursoLambda));

    const asistenciaResource = educativoResource.addResource('asistencia');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(asistenciaResource, method, asistenciaLambda));

    const contenidoResource = educativoResource.addResource('contenido');
    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => addLambdaRoute(contenidoResource, method, contenidoEducativoLambda));

    // --- /login/roles
    const loginResource = api.root.addResource('login');
    loginResource.addResource('admin').addMethod('GET', new apigateway.LambdaIntegration(adminLambda));
    loginResource.addResource('profesores').addMethod('GET', new apigateway.LambdaIntegration(profesoresLambda));
    loginResource.addResource('alumnos').addMethod('GET', new apigateway.LambdaIntegration(alumnosLambda));
    loginResource.addResource('fono').addMethod('GET', new apigateway.LambdaIntegration(fonoLambda));

    // --- /toma-hora
    const tomaHoraResource = api.root.addResource('toma-hora');
    tomaHoraResource.addMethod('GET', new apigateway.LambdaIntegration(tomaHoraLambda));

    // ----------------------------
    // Outputs
    // ----------------------------
    new cdk.CfnOutput(this, 'API Gateway URL', { value: api.url ?? 'NO URL' });
    new cdk.CfnOutput(this, 'ImagesBucket', { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, 'EduBucket', { value: eduBucket.bucketName });
  }
}
