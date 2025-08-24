import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class BoyHappyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------
    // Tablas DynamoDB
    // ----------------------------
    const eventosTable = new dynamodb.Table(this, 'EventosTable', {
      tableName: 'Eventos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const matriculasTable = new dynamodb.Table(this, 'MatriculasTable', {
      tableName: 'MatriculasSolicitudes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----------------------------
    // Lambda helper
    // ----------------------------
    const createLambda = (name: string, handlerFile: string) => {
      return new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${handlerFile}.handler`,
        code: lambda.Code.fromAsset('lambdas'),
      });
    };

    const homeLambda = createLambda('HomeLambda', 'home');
    const imagesLambda = createLambda('ImagesLambda', 'images');
    const matriculaLambda = createLambda('MatriculaLambda', 'matricula'); // HTML del form

    const alumnosLambda = createLambda('AlumnosLambda', 'alumnos');
    const profesoresLambda = createLambda('ProfesoresLambda', 'profesores');
    const adminLambda = createLambda('AdminLambda', 'admin');

    // ----------------------------
    // Lambdas con Dynamo
    // ----------------------------
    const eventosLambda = new lambda.Function(this, 'EventosLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'eventos.handler',
      code: lambda.Code.fromAsset('lambdas'),
      environment: {
        TABLE_NAME: eventosTable.tableName,
      },
    });
    eventosTable.grantReadWriteData(eventosLambda);

    const subirMatriculaLambda = new lambda.Function(this, 'SubirMatriculaLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'subir_matricula.handler',
      code: lambda.Code.fromAsset('lambdas'),
      environment: {
        MATRICULAS_TABLE: matriculasTable.tableName,
      },
    });
    matriculasTable.grantReadWriteData(subirMatriculaLambda);

    // ----------------------------
    // API Gateway con CORS
    // ----------------------------
    const api = new apigateway.RestApi(this, 'BoyHappyApi', {
      restApiName: 'BoyHappy Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      },
    });

    // Rutas eventos
    const eventos = api.root.addResource('eventos');
    eventos.addMethod('POST', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('GET', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('DELETE', new apigateway.LambdaIntegration(eventosLambda));
    eventos.addMethod('PUT', new apigateway.LambdaIntegration(eventosLambda));

    // Matrículas: GET = formulario
    const matriculasApi = api.root.addResource('matriculas');
    matriculasApi.addMethod('GET', new apigateway.LambdaIntegration(matriculaLambda));

    // Guardar matrícula
    const subirMatriculaApi = api.root.addResource('subir-matricula');
    subirMatriculaApi.addMethod('POST', new apigateway.LambdaIntegration(subirMatriculaLambda));
    subirMatriculaApi.addMethod('GET', new apigateway.LambdaIntegration(subirMatriculaLambda));


    // Rutas generales
    api.root.addMethod('GET', new apigateway.LambdaIntegration(homeLambda));
    api.root.addResource('imagenes').addMethod('GET', new apigateway.LambdaIntegration(imagesLambda));

    // Login por rol
    const login = api.root.addResource('login');
    login.addResource('admin').addMethod('GET', new apigateway.LambdaIntegration(adminLambda));
    login.addResource('profesores').addMethod('GET', new apigateway.LambdaIntegration(profesoresLambda));
    login.addResource('alumnos').addMethod('GET', new apigateway.LambdaIntegration(alumnosLambda));

    // ----------------------------
    // Output URL
    // ----------------------------
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: api.url ?? 'No URL created',
    });
  }
}
