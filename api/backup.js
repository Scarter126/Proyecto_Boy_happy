const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TABLAS = [
  process.env.USUARIOS_TABLE,
  process.env.COMUNICACIONES_TABLE,
  process.env.ASISTENCIA_TABLE,
  process.env.RECURSOS_TABLE,
  process.env.RETROALIMENTACION_TABLE,
  process.env.AGENDA_TABLE,
  process.env.CONFIGURACION_TABLE,
  process.env.INFORMES_TABLE,
  process.env.REPORTES_TABLE,
  process.env.APODERADOS_TABLE,
  process.env.APODERADO_ALUMNO_TABLE,
  process.env.PROFESOR_CURSO_TABLE
].filter(Boolean);

const BACKUP_BUCKET = process.env.BACKUP_BUCKET;
const MAX_BACKUPS = 30;

/**
 * CU-12: Gestión de respaldos
 *
 * Sistema automático de backups:
 * - Ejecutado diariamente por EventBridge
 * - Retención de 30 backups
 * - Backup de DynamoDB + S3
 */
exports.handler = async (event) => {
  console.log('Backup iniciado:', JSON.stringify(event, null, 2));

  try {
    // Si es invocación manual (GET), verificar autorización
    if (event.httpMethod === 'GET') {
      const authResult = authorize(event);
      if (!authResult.authorized) {
        return authResult.response;
      }

      // Retornar información del último backup
      return await obtenerUltimoBackup();
    }

    // Invocación automática desde EventBridge o manual POST
    if (!event.httpMethod || event.httpMethod === 'POST') {
      const backupId = `backup-${new Date().toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
      const timestamp = new Date().toISOString();

      console.log(`Iniciando backup ${backupId}`);

      // 1. Backup de cada tabla de DynamoDB
      const tablasBackup = [];
      for (const tabla of TABLAS) {
        try {
          const items = await obtenerTodosLosItems(tabla);
          const backupKey = `dynamodb/${backupId}/${tabla}.json`;

          await s3Client.send(new PutObjectCommand({
            Bucket: BACKUP_BUCKET,
            Key: backupKey,
            Body: JSON.stringify(items, null, 2),
            ContentType: 'application/json',
            Metadata: {
              'backup-id': backupId,
              'tabla': tabla,
              'timestamp': timestamp,
              'total-items': items.length.toString()
            }
          }));

          tablasBackup.push({ tabla, items: items.length, key: backupKey });
          console.log(`✅ Backup de ${tabla}: ${items.length} items`);
        } catch (error) {
          console.error(`❌ Error en backup de ${tabla}:`, error);
          tablasBackup.push({ tabla, error: error.message });
        }
      }

      // 2. Crear manifiesto del backup
      const manifiesto = {
        backupId,
        timestamp,
        tipo: 'automatico',
        tablas: tablasBackup,
        totalTablas: TABLAS.length,
        estado: 'completado'
      };

      await s3Client.send(new PutObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: `manifiestos/${backupId}.json`,
        Body: JSON.stringify(manifiesto, null, 2),
        ContentType: 'application/json'
      }));

      console.log('📦 Manifiesto creado:', backupId);

      // 3. Limpiar backups antiguos (retener solo 30)
      await limpiarBackupsAntiguos();

      // 4. Registrar en tabla de configuración (para consulta del último backup)
      try {
        await docClient.send(new PutCommand({
          TableName: process.env.CONFIGURACION_TABLE,
          Item: {
            id: 'ultimo-backup',
            backupId,
            timestamp,
            tablas: tablasBackup.map(t => ({ tabla: t.tabla, items: t.items })),
            estado: 'completado'
          }
        }));
      } catch (error) {
        console.error('Error registrando último backup:', error);
      }

      console.log('✅ Backup completado:', backupId);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Backup completado exitosamente',
          backupId,
          timestamp,
          tablas: tablasBackup
        })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método no soportado' })
    };

  } catch (error) {
    console.error('Error en backup:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error en backup',
        error: error.message
      })
    };
  }
};

/**
 * Obtener todos los items de una tabla DynamoDB
 */
async function obtenerTodosLosItems(tableName) {
  const items = [];
  let lastEvaluatedKey = null;

  do {
    const params = {
      TableName: tableName,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };

    const result = await docClient.send(new ScanCommand(params));
    items.push(...result.Items);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Limpiar backups antiguos, mantener solo los últimos 30
 */
async function limpiarBackupsAntiguos() {
  try {
    // Listar manifiestos
    const manifiestos = await s3Client.send(new ListObjectsV2Command({
      Bucket: BACKUP_BUCKET,
      Prefix: 'manifiestos/'
    }));

    if (!manifiestos.Contents || manifiestos.Contents.length <= MAX_BACKUPS) {
      console.log(`📊 Backups actuales: ${manifiestos.Contents?.length || 0}/${MAX_BACKUPS}`);
      return;
    }

    // Ordenar por fecha (más antiguos primero)
    const sortedBackups = manifiestos.Contents
      .sort((a, b) => a.LastModified - b.LastModified);

    // Eliminar los más antiguos
    const backupsAEliminar = sortedBackups.slice(0, sortedBackups.length - MAX_BACKUPS);

    for (const backup of backupsAEliminar) {
      const backupId = backup.Key.replace('manifiestos/', '').replace('.json', '');

      // Eliminar archivos del backup
      const archivos = await s3Client.send(new ListObjectsV2Command({
        Bucket: BACKUP_BUCKET,
        Prefix: `dynamodb/${backupId}/`
      }));

      if (archivos.Contents && archivos.Contents.length > 0) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: BACKUP_BUCKET,
          Delete: {
            Objects: archivos.Contents.map(obj => ({ Key: obj.Key }))
          }
        }));
      }

      // Eliminar manifiesto
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: BACKUP_BUCKET,
        Delete: {
          Objects: [{ Key: backup.Key }]
        }
      }));

      console.log(`🗑️ Backup eliminado: ${backupId}`);
    }

    console.log(`✅ Limpieza completada. Backups eliminados: ${backupsAEliminar.length}`);
  } catch (error) {
    console.error('Error limpiando backups antiguos:', error);
  }
}

/**
 * Obtener información del último backup
 */
async function obtenerUltimoBackup() {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.CONFIGURACION_TABLE,
      Key: { id: 'ultimo-backup' }
    }));

    if (!result.Item) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: 'No hay backups registrados',
          ultimoBackup: null
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ultimoBackup: {
          fecha: result.Item.timestamp,
          backupId: result.Item.backupId,
          tablas: result.Item.tablas,
          estado: result.Item.estado
        }
      })
    };
  } catch (error) {
    console.error('Error obteniendo último backup:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
}
