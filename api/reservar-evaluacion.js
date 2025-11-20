const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, DeleteCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AGENDA_TABLE;

exports.handler = async (event) => {
  // ------------------------
  // GET → Listar agendados y bloqueos
  // ------------------------
  if (event.httpMethod === 'GET') {
    try {
      const result = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.Items || [])
      };
    } catch (error) {
      // Si la tabla no existe (desarrollo local), retornar array vacío
      if (error.name === 'ResourceNotFoundException' || error.message?.includes('Requested resource not found')) {
        console.warn('⚠️ Tabla de agenda no existe - retornando array vacío para desarrollo');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([])
        };
      }
      throw error;
    }
  }

  // ------------------------
  // DELETE → Eliminar reserva o bloqueo
  // ------------------------
  if (event.httpMethod === 'DELETE') {
    let data;
    try { data = JSON.parse(event.body); } 
    catch (err) { return { statusCode: 400, body: 'Datos inválidos' }; }

    if (!data.fechaHora) return { statusCode: 400, body: 'Falta fechaHora' };

    await dynamo.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { fechaHora: data.fechaHora } }));
    return { statusCode: 200, body: 'Eliminado correctamente' };
  }

  // ------------------------
  // POST → Reservar, Bloquear, o Aceptar
  // ------------------------
  if (event.httpMethod === 'POST') {
    let data;
    try { data = JSON.parse(event.body); } 
    catch (err) { return { statusCode: 400, body: 'Datos inválidos' }; }

    const { tipo, fechaHora, nombreAlumno, rutAlumno, fechaNacimiento, telefono, correo, nombreApoderado, rutApoderado, rutFono, nombreFono } = data;

    if (!fechaHora) return { statusCode: 400, body: 'Falta fechaHora' };

    // ------------------------
    // ACEPTAR PACIENTE
    // ------------------------
    if (tipo === 'aceptar') {
      const existing = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { fechaHora } }));
      if (!existing.Item) return { statusCode: 404, body: 'Reserva no encontrada' };
      if (existing.Item.nombreAlumno === 'Ocupado') return { statusCode: 400, body: 'No se puede aceptar un bloqueo' };

      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { fechaHora },
        UpdateExpression: 'SET aceptado = :v',
        ExpressionAttributeValues: { ':v': true }
      }));

      return { statusCode: 200, body: 'Paciente aceptado correctamente' };
    }

    // ------------------------
    // BLOQUEO DE HORARIO
    // ------------------------
    const esBloqueo = nombreAlumno === 'Ocupado';

    if (!esBloqueo && (!nombreAlumno || !rutAlumno || !fechaNacimiento || !telefono || !correo || !nombreApoderado || !rutApoderado || !rutFono || !nombreFono)) {
      return { statusCode: 400, body: 'Faltan datos obligatorios' };
    }

    const existing = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { fechaHora } }));
    if (existing.Item) return { statusCode: 409, body: 'Horario ya tomado' };

    const item = { fechaHora, timestamp: new Date().toISOString() };

    if (esBloqueo) {
      item.nombreAlumno = 'Ocupado';
      item.rutAlumno = 'Ocupado';
      item.bloqueadoPorFono = true;
    } else {
      Object.assign(item, { nombreAlumno, rutAlumno, fechaNacimiento, telefono, correo, nombreApoderado, rutApoderado, rutFono, nombreFono });
    }

    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    return {
      statusCode: 200,
      body: esBloqueo
        ? `Horario ${fechaHora} bloqueado correctamente`
        : `Reserva para ${nombreAlumno} creada correctamente`
    };
  }

  return { statusCode: 405, body: 'Método no permitido' };
};
