/**
 * Script de Restauración de Backup para BoyHappy
 *
 * Restaura el sistema desde el último backup disponible en S3.
 *
 * Uso:
 *   node scripts/restore-backup.js                    # Restaurar último backup
 *   node scripts/restore-backup.js <backup-id>        # Restaurar backup específico
 *   node scripts/restore-backup.js --list             # Listar backups disponibles
 *
 * Requisitos:
 *   - AWS CLI configurado con credenciales válidas
 *   - Permisos de lectura en S3 bucket de backups
 *   - Permisos de escritura en tablas DynamoDB
 */

const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const readline = require('readline');

// Configurar clientes AWS
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Configuración
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || 'boyhappy-backups';
const BATCH_SIZE = 25; // Límite de DynamoDB BatchWrite

// Mapeo de nombres de tablas
const TABLAS = {
  'Usuarios': 'Usuarios',
  'Comunicaciones': 'Comunicaciones',
  'Asistencia': 'Asistencia',
  'RecursosAcademicos': 'RecursosAcademicos',
  'Retroalimentacion': 'Retroalimentacion',
  'AgendaFonoaudiologia': 'AgendaFonoaudiologia',
  'Configuracion': 'Configuracion',
  'Informes': 'Informes',
  'Reportes': 'Reportes',
  'Apoderados': 'Apoderados',
  'ApoderadoAlumno': 'ApoderadoAlumno',
  'ProfesorCurso': 'ProfesorCurso'
};

/**
 * Interfaz de línea de comandos
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const pregunta = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Listar backups disponibles
 */
async function listarBackups() {
  console.log('\n📦 Listando backups disponibles...\n');

  try {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BACKUP_BUCKET,
      Prefix: 'manifiestos/',
      Delimiter: '/'
    }));

    if (!response.Contents || response.Contents.length === 0) {
      console.log('❌ No se encontraron backups disponibles.');
      return [];
    }

    const backups = [];
    for (const obj of response.Contents) {
      // Descargar manifiesto
      const getCmd = new GetObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: obj.Key
      });

      const data = await s3Client.send(getCmd);
      const body = await streamToString(data.Body);
      const manifiesto = JSON.parse(body);

      backups.push({
        backupId: manifiesto.backupId,
        timestamp: manifiesto.timestamp,
        fecha: new Date(manifiesto.timestamp).toLocaleString('es-CL'),
        tablas: manifiesto.tablas.length,
        totalItems: manifiesto.tablas.reduce((sum, t) => sum + (t.items || 0), 0),
        estado: manifiesto.estado
      });
    }

    // Ordenar por fecha descendente (más reciente primero)
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                        BACKUPS DISPONIBLES                          │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');

    backups.forEach((backup, index) => {
      const marker = index === 0 ? '⭐ ÚLTIMO' : `   #${index + 1}`;
      console.log(`│ ${marker.padEnd(10)} │ ${backup.backupId.padEnd(45)} │`);
      console.log(`│            │ Fecha: ${backup.fecha.padEnd(37)} │`);
      console.log(`│            │ Tablas: ${backup.tablas} | Items: ${backup.totalItems.toString().padEnd(20)} │`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
    });

    console.log('└─────────────────────────────────────────────────────────────────────┘\n');

    return backups;

  } catch (error) {
    console.error('❌ Error listando backups:', error.message);
    return [];
  }
}

/**
 * Obtener el último backup
 */
async function obtenerUltimoBackup() {
  const backups = await listarBackups();
  return backups.length > 0 ? backups[0] : null;
}

/**
 * Descargar manifiesto de un backup
 */
async function descargarManifiesto(backupId) {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: `manifiestos/${backupId}.json`
    }));

    const body = await streamToString(response.Body);
    return JSON.parse(body);

  } catch (error) {
    console.error(`❌ Error descargando manifiesto de ${backupId}:`, error.message);
    return null;
  }
}

/**
 * Descargar datos de una tabla desde S3
 */
async function descargarDatosTabla(backupId, nombreTabla) {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: `dynamodb/${backupId}/${nombreTabla}.json`
    }));

    const body = await streamToString(response.Body);
    return JSON.parse(body);

  } catch (error) {
    console.error(`❌ Error descargando datos de ${nombreTabla}:`, error.message);
    return null;
  }
}

/**
 * Limpiar tabla DynamoDB (eliminar todos los items)
 */
async function limpiarTabla(nombreTabla) {
  try {
    console.log(`   🗑️  Limpiando tabla ${nombreTabla}...`);

    // Escanear todos los items
    const items = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: nombreTabla,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      };

      const result = await docClient.send(new ScanCommand(params));
      items.push(...result.Items);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (items.length === 0) {
      console.log(`   ℹ️  Tabla ${nombreTabla} ya está vacía.`);
      return 0;
    }

    // Eliminar en lotes
    const batches = chunk(items, BATCH_SIZE);
    let deletedCount = 0;

    for (const batch of batches) {
      const deleteRequests = batch.map(item => {
        // Detectar claves primarias según la tabla
        const key = getTableKey(nombreTabla, item);
        return {
          DeleteRequest: { Key: key }
        };
      });

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [nombreTabla]: deleteRequests
        }
      }));

      deletedCount += batch.length;
    }

    console.log(`   ✅ ${deletedCount} items eliminados de ${nombreTabla}`);
    return deletedCount;

  } catch (error) {
    console.error(`   ❌ Error limpiando ${nombreTabla}:`, error.message);
    throw error;
  }
}

/**
 * Restaurar datos en una tabla DynamoDB
 */
async function restaurarTabla(nombreTabla, items) {
  try {
    console.log(`   📥 Restaurando ${items.length} items en ${nombreTabla}...`);

    if (items.length === 0) {
      console.log(`   ℹ️  No hay items para restaurar en ${nombreTabla}`);
      return 0;
    }

    const batches = chunk(items, BATCH_SIZE);
    let restoredCount = 0;

    for (const batch of batches) {
      const putRequests = batch.map(item => ({
        PutRequest: { Item: item }
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [nombreTabla]: putRequests
        }
      }));

      restoredCount += batch.length;
      process.stdout.write(`\r   📥 Progreso: ${restoredCount}/${items.length} items`);
    }

    console.log(`\n   ✅ ${restoredCount} items restaurados en ${nombreTabla}`);
    return restoredCount;

  } catch (error) {
    console.error(`\n   ❌ Error restaurando ${nombreTabla}:`, error.message);
    throw error;
  }
}

/**
 * Proceso principal de restauración
 */
async function restaurarBackup(backupId) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        🔄 PROCESO DE RESTAURACIÓN DE BACKUP              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Descargar manifiesto
    console.log(`📋 Descargando manifiesto de backup: ${backupId}...`);
    const manifiesto = await descargarManifiesto(backupId);

    if (!manifiesto) {
      console.error('❌ No se pudo cargar el manifiesto del backup.');
      return false;
    }

    console.log(`✅ Manifiesto cargado correctamente`);
    console.log(`   - Fecha: ${new Date(manifiesto.timestamp).toLocaleString('es-CL')}`);
    console.log(`   - Tablas: ${manifiesto.tablas.length}`);
    console.log(`   - Estado: ${manifiesto.estado}\n`);

    // 2. Confirmar restauración
    console.log('⚠️  ADVERTENCIA: Esta operación eliminará TODOS los datos actuales');
    console.log('   y los reemplazará con los datos del backup.\n');

    const confirmacion = await pregunta('¿Desea continuar? (escriba "SI" para confirmar): ');

    if (confirmacion.toUpperCase() !== 'SI') {
      console.log('\n❌ Restauración cancelada por el usuario.\n');
      return false;
    }

    console.log('\n🚀 Iniciando restauración...\n');

    // 3. Restaurar cada tabla
    const resultados = [];

    for (const tablaInfo of manifiesto.tablas) {
      const nombreTabla = tablaInfo.tabla;

      console.log(`\n📦 Procesando tabla: ${nombreTabla}`);
      console.log('─'.repeat(60));

      try {
        // Descargar datos del backup
        const items = await descargarDatosTabla(backupId, nombreTabla);

        if (!items) {
          console.log(`   ⚠️  No se encontraron datos para ${nombreTabla}`);
          resultados.push({ tabla: nombreTabla, estado: 'sin_datos', items: 0 });
          continue;
        }

        // Limpiar tabla actual
        const itemsEliminados = await limpiarTabla(nombreTabla);

        // Restaurar datos del backup
        const itemsRestaurados = await restaurarTabla(nombreTabla, items);

        resultados.push({
          tabla: nombreTabla,
          estado: 'completado',
          eliminados: itemsEliminados,
          restaurados: itemsRestaurados
        });

      } catch (error) {
        console.error(`   ❌ Error procesando ${nombreTabla}:`, error.message);
        resultados.push({
          tabla: nombreTabla,
          estado: 'error',
          error: error.message
        });
      }
    }

    // 4. Resumen final
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              📊 RESUMEN DE RESTAURACIÓN                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let totalRestaurado = 0;
    let tablasFallidas = 0;

    resultados.forEach(resultado => {
      const estado = resultado.estado === 'completado' ? '✅' :
                     resultado.estado === 'sin_datos' ? '⚠️ ' : '❌';

      console.log(`${estado} ${resultado.tabla}`);

      if (resultado.estado === 'completado') {
        console.log(`   Items restaurados: ${resultado.restaurados}`);
        totalRestaurado += resultado.restaurados;
      } else if (resultado.estado === 'error') {
        console.log(`   Error: ${resultado.error}`);
        tablasFallidas++;
      }
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total de items restaurados: ${totalRestaurado}`);
    console.log(`Tablas con errores: ${tablasFallidas}`);
    console.log('─'.repeat(60) + '\n');

    if (tablasFallidas === 0) {
      console.log('✅ Restauración completada exitosamente.\n');
      return true;
    } else {
      console.log('⚠️  Restauración completada con errores.\n');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Error durante la restauración:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Utilidades
 */

// Convertir Stream a String
async function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

// Dividir array en chunks
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Obtener clave primaria según la tabla
function getTableKey(nombreTabla, item) {
  switch (nombreTabla) {
    case 'Usuarios':
      return { rut: item.rut };

    case 'Comunicaciones':
      return { id: item.id, timestamp: item.timestamp };

    case 'Asistencia':
      return { id: item.id };

    case 'RecursosAcademicos':
      return { id: item.id, tipo: item.tipo };

    case 'Retroalimentacion':
      return { rutUsuario: item.rutUsuario, timestamp: item.timestamp };

    case 'AgendaFonoaudiologia':
      return { fechaHora: item.fechaHora };

    case 'Configuracion':
      return { id: item.id };

    case 'Informes':
      return { id: item.id, timestamp: item.timestamp };

    case 'Reportes':
      return { id: item.id, timestamp: item.timestamp };

    case 'Apoderados':
      return { rut: item.rut };

    case 'ApoderadoAlumno':
      return { apoderadoRut: item.apoderadoRut, alumnoRut: item.alumnoRut };

    case 'ProfesorCurso':
      return { profesorRut: item.profesorRut, cursoTipo: item.cursoTipo };

    default:
      // Intentar detectar automáticamente
      return item.id ? { id: item.id } : item;
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    // Modo: Listar backups
    if (args.includes('--list') || args.includes('-l')) {
      await listarBackups();
      rl.close();
      process.exit(0);
    }

    // Modo: Restaurar backup específico
    if (args.length > 0 && !args[0].startsWith('--')) {
      const backupId = args[0];
      console.log(`\n🎯 Restaurando backup específico: ${backupId}\n`);

      const exito = await restaurarBackup(backupId);
      rl.close();
      process.exit(exito ? 0 : 1);
    }

    // Modo: Restaurar último backup (default)
    console.log('🔍 Buscando el último backup disponible...\n');
    const ultimoBackup = await obtenerUltimoBackup();

    if (!ultimoBackup) {
      console.error('❌ No se encontraron backups disponibles.\n');
      rl.close();
      process.exit(1);
    }

    console.log(`\n⭐ Último backup encontrado: ${ultimoBackup.backupId}`);
    console.log(`   Fecha: ${ultimoBackup.fecha}`);
    console.log(`   Items: ${ultimoBackup.totalItems}\n`);

    const confirmar = await pregunta('¿Desea restaurar este backup? (S/N): ');

    if (confirmar.toUpperCase() !== 'S') {
      console.log('\n❌ Operación cancelada.\n');
      rl.close();
      process.exit(0);
    }

    const exito = await restaurarBackup(ultimoBackup.backupId);
    rl.close();
    process.exit(exito ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { restaurarBackup, listarBackups, obtenerUltimoBackup };