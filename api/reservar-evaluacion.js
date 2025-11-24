const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, DeleteCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { getCorsHeaders } = requireLayer('responseHelper');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = TABLE_NAMES.AGENDA_TABLE;

exports.handler = async (event) => {
  // Obtener headers CORS dinámicos basados en el origen del request
  const corsHeaders = getCorsHeaders(event);
  // ------------------------
  // GET → Listar agendados y bloqueos
  // ------------------------
  if (event.httpMethod === 'GET') {
    try {
      const result = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));

      // Filtrar solo slots disponibles (sin nombreAlumno asignado)
      // Un slot está disponible si NO tiene nombreAlumno o es string vacío
      // Los bloqueos (nombreAlumno === 'Ocupado') y reservas NO aparecen
      const slotsDisponibles = (result.Items || []).filter(slot => {
        return !slot.nombreAlumno || slot.nombreAlumno.trim() === '';
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(slotsDisponibles)
      };
    } catch (error) {
      // Si la tabla no existe (desarrollo local), retornar array vacío
      if (error.name === 'ResourceNotFoundException' || error.message?.includes('Requested resource not found')) {
        console.warn('⚠️ Tabla de agenda no existe - retornando array vacío para desarrollo');
        return {
          statusCode: 200,
          headers: corsHeaders,
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
    catch (err) { return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Datos inválidos' })
    }; }

    if (!data.fechaHora) return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Falta fechaHora' })
    };

    await dynamo.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { fechaHora: data.fechaHora } }));
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Eliminado correctamente' })
    };
  }

  // ------------------------
  // POST → Reservar, Bloquear, o Aceptar
  // ------------------------
  if (event.httpMethod === 'POST') {
    let data;
    try { data = JSON.parse(event.body); }
    catch (err) { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Datos inválidos' }) }; }

    const { tipo, fechaHora, nombreAlumno, rutAlumno, fechaNacimiento, telefono, correo, nombreApoderado, rutApoderado, rutFono, nombreFono } = data;

    if (!fechaHora) return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Falta fechaHora' })
    };

    // ------------------------
    // ACEPTAR PACIENTE
    // ------------------------
    if (tipo === 'aceptar') {
      const existing = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { fechaHora } }));
      if (!existing.Item) return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Reserva no encontrada' })
      };
      if (existing.Item.nombreAlumno === 'Ocupado') return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No se puede aceptar un bloqueo' })
      };

      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { fechaHora },
        UpdateExpression: 'SET aceptado = :v',
        ExpressionAttributeValues: { ':v': true }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Paciente aceptado correctamente' })
      };
    }

    // ------------------------
    // BLOQUEO DE HORARIO
    // ------------------------
    const esBloqueo = nombreAlumno === 'Ocupado';

    if (!esBloqueo && (!nombreAlumno || !rutAlumno || !fechaNacimiento || !telefono || !correo || !nombreApoderado || !rutApoderado || !rutFono || !nombreFono)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Faltan datos obligatorios' })
      };
    }

    const existing = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { fechaHora } }));
    // Validar si el slot ya tiene un alumno asignado (no solo si existe)
    if (existing.Item && existing.Item.nombreAlumno && existing.Item.nombreAlumno.trim() !== '') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Horario ya tomado' })
      };
    }

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
      headers: corsHeaders,
      body: JSON.stringify({
        message: esBloqueo
          ? `Horario ${fechaHora} bloqueado correctamente`
          : `Reserva para ${nombreAlumno} creada correctamente`
      })
    };
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Método no permitido' })
  };
};

// Metadata para auto-discovery de CDK
exports.metadata = {
  route: '/reservar-evaluacion',
  methods: ['GET', 'POST', 'DELETE'],
  auth: false,
  profile: 'medium',
  tables: [`${TABLE_KEYS.AGENDA_TABLE}:readwrite`]
};
