const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient();

// Variables de entorno
const EVENTOS_TABLE = process.env.TABLE_NAME;       // EventosComunicaciones
const MATRICULAS_TABLE = process.env.MATRICULAS_TABLE; // Nueva tabla de matrículas

exports.handler = async (event) => {
  try {
    const { httpMethod, resource } = event;

    // --- 📌 EVENTOS ---
    if (resource === "/eventos") {
      if (httpMethod === "POST") {
        const data = JSON.parse(event.body);
        const item = {
          id: uuidv4(),
          titulo: data.titulo,
          descripcion: data.descripcion,
          fecha: data.fecha,
          hora: data.hora || "",
          tipo: data.tipo,
          curso: data.curso
        };
        await docClient.put({ TableName: EVENTOS_TABLE, Item: item }).promise();
        return { statusCode: 200, body: JSON.stringify(item) };
      }

      if (httpMethod === "GET") {
        const result = await docClient.scan({ TableName: EVENTOS_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify(result.Items) };
      }

      if (httpMethod === "DELETE") {
        const { id } = event.queryStringParameters;
        await docClient.delete({ TableName: EVENTOS_TABLE, Key: { id } }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: "Evento eliminado" }) };
      }

      if (httpMethod === "PUT") {
        const { id } = event.queryStringParameters;
        const data = JSON.parse(event.body);
        await docClient.update({
          TableName: EVENTOS_TABLE,
          Key: { id },
          UpdateExpression: "set titulo=:t, descripcion=:d, fecha=:f, hora=:h, tipo=:tp, curso=:c",
          ExpressionAttributeValues: {
            ":t": data.titulo,
            ":d": data.descripcion,
            ":f": data.fecha,
            ":h": data.hora || "",
            ":tp": data.tipo,
            ":c": data.curso
          }
        }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: "Evento actualizado" }) };
      }
    }

    // --- 📌 MATRÍCULAS ---
    if (resource === "/matriculas") {
      if (httpMethod === "POST") {
        const data = JSON.parse(event.body);
        const item = {
          id: uuidv4(),
          nombre: data.nombre,
          rut: data.rut,
          fechaNacimiento: data.fechaNacimiento,
          ultimoCurso: data.ultimoCurso,
          correo: data.correo,
          telefono: data.telefono,
          fechaRegistro: new Date().toISOString()
        };
        await docClient.put({ TableName: MATRICULAS_TABLE, Item: item }).promise();
        return { statusCode: 200, body: JSON.stringify(item) };
      }

      if (httpMethod === "GET") {
        const result = await docClient.scan({ TableName: MATRICULAS_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify(result.Items) };
      }
    }

    return { statusCode: 400, body: "Ruta o método no soportado" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
