const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const AGENDA_TABLE = process.env.AGENDA_TABLE;
const MATERIALES_BUCKET = process.env.MATERIALES_BUCKET;

/**
 * CU-41: Registrar sesión terapéutica
 * CU-42: Subir documentos de sesiones
 * CU-43: Modificar archivos de apoyo
 * CU-44: Eliminar archivos de apoyo
 * CU-45: Documentar actividades de sesión
 */
exports.handler = async (event) => {

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // CU-42: POST /archivos-sesion - Subir archivo independiente
    // ========================================
    if (httpMethod === 'POST' && (path === '/archivos-sesion' || path === '/archivos-sesion/')) {
      const data = JSON.parse(event.body);

      if (!data.rutAlumno || !data.archivoData || !data.nombreArchivo) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: rutAlumno, archivoData, nombreArchivo' })
        };
      }

      const archivoId = `archivo-sesion-${uuidv4()}`;
      const extension = data.nombreArchivo.split('.').pop();
      const s3Key = `sesiones-fono/${data.rutAlumno}/${archivoId}.${extension}`;

      // Decodificar base64 y subir a S3
      const base64Data = data.archivoData.split(',')[1] || data.archivoData;
      const buffer = Buffer.from(base64Data, 'base64');

      await s3Client.send(new PutObjectCommand({
        Bucket: MATERIALES_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: data.contentType || 'application/octet-stream'
      }));

      // Crear registro en DynamoDB
      const item = {
        fechaHora: `archivo-${new Date().toISOString()}`, // PK única
        id: archivoId,
        tipo: 'archivo-sesion-terapeutica',
        rutAlumno: data.rutAlumno,
        nombreAlumno: data.nombreAlumno || '',
        nombreArchivo: data.nombreArchivo,
        tipoArchivo: data.tipoArchivo || 'documento',
        fechaSesion: data.fechaSesion || new Date().toISOString().split('T')[0],
        descripcion: data.descripcion || '',
        url: `s3://${MATERIALES_BUCKET}/${s3Key}`,
        fechaSubida: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: AGENDA_TABLE,
        Item: item
      }));

      // Generar URL firmada para descarga
      const command = new GetObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key });
      item.downloadURL = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // CU-42: GET /archivos-sesion - Listar archivos con filtros
    // ========================================
    if (httpMethod === 'GET' && (path === '/archivos-sesion' || path === '/archivos-sesion/')) {
      // Si hay ID específico, retornar ese archivo
      if (queryStringParameters?.id) {
        const scanResult = await docClient.send(new ScanCommand({
          TableName: AGENDA_TABLE
        }));

        const archivo = scanResult.Items.find(item =>
          item.id === queryStringParameters.id && item.tipo === 'archivo-sesion-terapeutica'
        );

        if (!archivo) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Archivo no encontrado' })
          };
        }

        // Generar URL firmada
        if (archivo.url && archivo.url.startsWith('s3://')) {
          const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
          const command = new GetObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key });
          archivo.downloadURL = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(archivo)
        };
      }

      // Listar todos los archivos con filtros
      const result = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE
      }));

      let archivos = result.Items.filter(item => item.tipo === 'archivo-sesion-terapeutica');

      // Filtros
      if (queryStringParameters?.rutAlumno) {
        archivos = archivos.filter(a => a.rutAlumno === queryStringParameters.rutAlumno);
      }
      if (queryStringParameters?.tipo) {
        archivos = archivos.filter(a => a.tipoArchivo === queryStringParameters.tipo);
      }

      // Generar URLs firmadas
      for (const archivo of archivos) {
        if (archivo.url && archivo.url.startsWith('s3://')) {
          const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
          const command = new GetObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key });
          archivo.downloadURL = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }
      }

      // Ordenar por fecha descendente
      archivos.sort((a, b) => new Date(b.fechaSubida) - new Date(a.fechaSubida));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archivos)
      };
    }

    // ========================================
    // CU-43: PUT /archivos-sesion?id=xxx - Modificar archivo
    // ========================================
    if (httpMethod === 'PUT' && (path === '/archivos-sesion' || path === '/archivos-sesion/')) {
      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Buscar archivo actual
      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE
      }));

      const archivo = scanResult.Items.find(item =>
        item.id === id && item.tipo === 'archivo-sesion-terapeutica'
      );

      if (!archivo) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Archivo no encontrado' })
        };
      }

      // Si viene nuevo archivo, reemplazar en S3
      if (data.archivoData && data.nombreArchivo) {
        const extension = data.nombreArchivo.split('.').pop();
        const s3Key = `sesiones-fono/${archivo.rutAlumno}/${id}.${extension}`;

        const base64Data = data.archivoData.split(',')[1] || data.archivoData;
        const buffer = Buffer.from(base64Data, 'base64');

        await s3Client.send(new PutObjectCommand({
          Bucket: MATERIALES_BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: data.contentType || 'application/octet-stream'
        }));

        archivo.url = `s3://${MATERIALES_BUCKET}/${s3Key}`;
        archivo.nombreArchivo = data.nombreArchivo;
      }

      // Actualizar metadatos
      if (data.tipoArchivo) archivo.tipoArchivo = data.tipoArchivo;
      if (data.descripcion !== undefined) archivo.descripcion = data.descripcion;
      if (data.fechaSesion) archivo.fechaSesion = data.fechaSesion;
      archivo.ultimaModificacion = new Date().toISOString();

      await docClient.send(new PutCommand({
        TableName: AGENDA_TABLE,
        Item: archivo
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Archivo actualizado correctamente', id })
      };
    }

    // ========================================
    // CU-44: DELETE /archivos-sesion?id=xxx - Eliminar archivo
    // ========================================
    if (httpMethod === 'DELETE' && (path === '/archivos-sesion' || path === '/archivos-sesion/')) {
      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;

      // Buscar archivo
      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE
      }));

      const archivo = scanResult.Items.find(item =>
        item.id === id && item.tipo === 'archivo-sesion-terapeutica'
      );

      if (!archivo) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Archivo no encontrado' })
        };
      }

      // Eliminar de S3
      if (archivo.url && archivo.url.startsWith('s3://')) {
        const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: MATERIALES_BUCKET,
            Key: s3Key
          }));
        } catch (error) {
          console.error('Error eliminando de S3:', error);
        }
      }

      // Eliminar de DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: AGENDA_TABLE,
        Key: { fechaHora: archivo.fechaHora }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Archivo eliminado correctamente', id })
      };
    }

    // ========================================
    // POST /sesiones - Registrar sesión completa
    // ========================================
    if (httpMethod === 'POST' && path === '/sesiones') {
      const data = JSON.parse(event.body);

      if (!data.fechaHora || !data.rutAlumno || !data.fonoaudiologo) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: fechaHora, rutAlumno, fonoaudiologo' })
        };
      }

      const item = {
        fechaHora: data.fechaHora, // PK
        id: `sesion-${uuidv4()}`,
        rutAlumno: data.rutAlumno,
        fonoaudiologo: data.fonoaudiologo,
        motivo: data.motivo || '',
        estado: data.estado || 'completada',
        actividadesRealizadas: data.actividadesRealizadas || [],
        materialUtilizado: data.materialUtilizado || [],
        observaciones: data.observaciones || '',
        avanceSesion: data.avanceSesion || '',
        tareasCasa: data.tareasCasa || [],
        archivosSesion: [],
        proximaSesion: data.proximaSesion || null,
        timestamp: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: AGENDA_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /sesiones - Listar sesiones
    // ========================================
    if (httpMethod === 'GET' && path === '/sesiones') {
      const result = await docClient.send(new ScanCommand({ TableName: AGENDA_TABLE }));

      let items = result.Items;

      // Filtros
      if (queryStringParameters?.rutAlumno) {
        items = items.filter(i => i.rutAlumno === queryStringParameters.rutAlumno);
      }
      if (queryStringParameters?.fonoaudiologo) {
        items = items.filter(i => i.fonoaudiologo === queryStringParameters.fonoaudiologo);
      }
      if (queryStringParameters?.estado) {
        items = items.filter(i => i.estado === queryStringParameters.estado);
      }
      if (queryStringParameters?.fechaInicio && queryStringParameters?.fechaFin) {
        items = items.filter(i =>
          i.fechaHora >= queryStringParameters.fechaInicio &&
          i.fechaHora <= queryStringParameters.fechaFin
        );
      }

      // Generar URLs firmadas para archivos
      for (const sesion of items) {
        if (sesion.archivosSesion && sesion.archivosSesion.length > 0) {
          for (const archivo of sesion.archivosSesion) {
            if (archivo.url && archivo.url.startsWith('s3://')) {
              const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
              const command = new GetObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key });
              archivo.urlDescarga = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesiones: items,
          total: items.length,
          sesionesCompletadas: items.filter(i => i.estado === 'completada').length,
          sesionesAgendadas: items.filter(i => i.estado === 'agendada').length,
          sesionesCanceladas: items.filter(i => i.estado === 'cancelada').length
        })
      };
    }

    // ========================================
    // PUT /sesiones?id=xxx - Actualizar sesión
    // ========================================
    if (httpMethod === 'PUT' && path === '/sesiones' && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Buscar sesión por id
      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!scanResult.Items || scanResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Sesión no encontrada' })
        };
      }

      const sesion = scanResult.Items[0];
      const updateParts = [];
      const attrValues = {};

      if (data.observaciones !== undefined) {
        updateParts.push('observaciones = :obs');
        attrValues[':obs'] = data.observaciones;
      }

      if (data.tareasCasa) {
        updateParts.push('tareasCasa = :tareas');
        attrValues[':tareas'] = data.tareasCasa;
      }

      if (data.actividadesRealizadas) {
        updateParts.push('actividadesRealizadas = :act');
        attrValues[':act'] = data.actividadesRealizadas;
      }

      if (data.avanceSesion !== undefined) {
        updateParts.push('avanceSesion = :av');
        attrValues[':av'] = data.avanceSesion;
      }

      if (data.estado) {
        updateParts.push('estado = :est');
        attrValues[':est'] = data.estado;
      }

      updateParts.push('ultimaModificacion = :ts');
      attrValues[':ts'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: AGENDA_TABLE,
        Key: { fechaHora: sesion.fechaHora },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Sesión actualizada correctamente', id })
      };
    }

    // ========================================
    // DELETE /sesiones?id=xxx - Eliminar sesión
    // ========================================
    if (httpMethod === 'DELETE' && path === '/sesiones' && queryStringParameters?.id) {
      const id = queryStringParameters.id;

      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!scanResult.Items || scanResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Sesión no encontrada' })
        };
      }

      const sesion = scanResult.Items[0];

      // Eliminar archivos de S3
      if (sesion.archivosSesion && sesion.archivosSesion.length > 0) {
        for (const archivo of sesion.archivosSesion) {
          if (archivo.url && archivo.url.startsWith('s3://')) {
            const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
            try {
              await s3Client.send(new DeleteObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key }));
            } catch (error) {
              console.error('Error eliminando archivo:', error);
            }
          }
        }
      }

      await docClient.send(new DeleteCommand({
        TableName: AGENDA_TABLE,
        Key: { fechaHora: sesion.fechaHora }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Sesión eliminada correctamente', id })
      };
    }

    // ========================================
    // POST /sesiones/archivos - Subir archivo
    // ========================================
    if (httpMethod === 'POST' && path === '/sesiones/archivos') {
      const data = JSON.parse(event.body);

      if (!data.sesionId || !data.archivoBase64 || !data.nombre) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: sesionId, archivoBase64, nombre' })
        };
      }

      const archivoId = `archivo-${uuidv4()}`;
      const extension = data.nombre.split('.').pop();
      const s3Key = `sesiones/${data.sesionId}/${archivoId}.${extension}`;

      // Subir a S3
      const buffer = Buffer.from(data.archivoBase64, 'base64');
      await s3Client.send(new PutObjectCommand({
        Bucket: MATERIALES_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: data.tipo || 'application/octet-stream'
      }));

      const archivoInfo = {
        id: archivoId,
        nombre: data.nombre,
        tipo: data.tipo || 'documento',
        url: `s3://${MATERIALES_BUCKET}/${s3Key}`,
        fechaSubida: new Date().toISOString()
      };

      // Actualizar sesión
      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': data.sesionId }
      }));

      if (scanResult.Items && scanResult.Items.length > 0) {
        const sesion = scanResult.Items[0];
        const archivos = sesion.archivosSesion || [];
        archivos.push(archivoInfo);

        await docClient.send(new UpdateCommand({
          TableName: AGENDA_TABLE,
          Key: { fechaHora: sesion.fechaHora },
          UpdateExpression: 'SET archivosSesion = :archivos',
          ExpressionAttributeValues: { ':archivos': archivos }
        }));
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Archivo subido correctamente', archivo: archivoInfo })
      };
    }

    // ========================================
    // DELETE /sesiones/archivos?id=xxx - Eliminar archivo
    // ========================================
    if (httpMethod === 'DELETE' && path === '/sesiones/archivos' && queryStringParameters?.id) {
      const archivoId = queryStringParameters.id;

      // Buscar en todas las sesiones
      const scanResult = await docClient.send(new ScanCommand({ TableName: AGENDA_TABLE }));

      for (const sesion of scanResult.Items) {
        if (sesion.archivosSesion && sesion.archivosSesion.length > 0) {
          const archivo = sesion.archivosSesion.find(a => a.id === archivoId);
          if (archivo) {
            // Eliminar de S3
            const s3Key = archivo.url.replace(`s3://${MATERIALES_BUCKET}/`, '');
            await s3Client.send(new DeleteObjectCommand({ Bucket: MATERIALES_BUCKET, Key: s3Key }));

            // Actualizar sesión
            const archivosActualizados = sesion.archivosSesion.filter(a => a.id !== archivoId);
            await docClient.send(new UpdateCommand({
              TableName: AGENDA_TABLE,
              Key: { fechaHora: sesion.fechaHora },
              UpdateExpression: 'SET archivosSesion = :archivos',
              ExpressionAttributeValues: { ':archivos': archivosActualizados }
            }));

            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Archivo eliminado correctamente', id: archivoId })
            };
          }
        }
      }

      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Archivo no encontrado' })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta o método no soportado' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Error interno del servidor', error: error.message })
    };
  }
};
