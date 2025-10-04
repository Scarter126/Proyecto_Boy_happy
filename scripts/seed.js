/**
 * Script Completo de Seeding para BoyHappy
 *
 * Este script realiza:
 * 1. Crea usuarios en AWS Cognito con contraseñas permanentes
 * 2. Asigna usuarios a sus grupos correspondientes (admin, profesor, fono, alumno)
 * 3. Inserta datos seed en DynamoDB (usuarios, comunicaciones, asistencias, etc.)
 * 4. Guarda las credenciales en un archivo JSON
 *
 * Uso: node scripts/seed.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configurar clientes AWS
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

const USER_POOL_ID = process.env.USER_POOL_ID;

if (!USER_POOL_ID) {
  console.error('❌ Error: USER_POOL_ID no encontrado en .env');
  process.exit(1);
}

// ========================================
// DATOS SEED
// ========================================

const usuariosData = [
  // Admin
  {
    rut: '12345678-9',
    nombre: 'María',
    apellido: 'González',
    correo: 'admin@boyhappy.cl',
    password: 'Admin123!',
    telefono: '+56912345678',
    rol: 'admin',
    fechaIngreso: '2024-01-01',
    cargo: 'Directora',
    activo: true,
  },

  // Profesores
  {
    rut: '23456789-0',
    nombre: 'Carlos',
    apellido: 'Ramírez',
    correo: 'carlos.ramirez@boyhappy.cl',
    password: 'Profesor123!',
    telefono: '+56923456789',
    rol: 'profesor',
    especialidad: 'Matemáticas, Ciencias',
    cursosAsignados: ['Kinder', 'Prekinder'],
    fechaIngreso: '2024-01-15',
    titulo: 'Profesor de Educación General Básica',
    activo: true,
  },
  {
    rut: '34567890-1',
    nombre: 'Ana',
    apellido: 'Torres',
    correo: 'ana.torres@boyhappy.cl',
    password: 'Profesor123!',
    telefono: '+56934567890',
    rol: 'profesor',
    especialidad: 'Lenguaje, Artes',
    cursosAsignados: ['Kinder'],
    fechaIngreso: '2024-02-01',
    titulo: 'Profesor de Educación Parvularia',
    activo: true,
  },

  // Fonoaudiólogos
  {
    rut: '45678901-2',
    nombre: 'Patricia',
    apellido: 'Muñoz',
    correo: 'patricia.munoz@boyhappy.cl',
    password: 'Fono123!',
    telefono: '+56945678901',
    rol: 'fono',
    especialidad: 'Trastornos del Lenguaje',
    fechaIngreso: '2024-01-20',
    titulo: 'Fonoaudiólogo',
    horarioAtencion: 'Lunes a Viernes 9:00-17:00',
    activo: true,
  },
  {
    rut: '56789012-3',
    nombre: 'Roberto',
    apellido: 'Silva',
    correo: 'roberto.silva@boyhappy.cl',
    password: 'Fono123!',
    telefono: '+56956789012',
    rol: 'fono',
    especialidad: 'Dificultades de Aprendizaje',
    fechaIngreso: '2024-02-15',
    titulo: 'Fonoaudiólogo',
    horarioAtencion: 'Lunes a Viernes 10:00-18:00',
    activo: true,
  },

  // Alumnos
  {
    rut: '67890123-4',
    nombre: 'Sofía',
    apellido: 'Pérez',
    correo: 'apoderado.sofia@gmail.com',
    password: 'Alumno123!',
    telefono: '+56967890123',
    rol: 'alumno',
    curso: 'Kinder',
    fechaNacimiento: '2019-05-15',
    direccion: 'Av. Principal 123, Santiago',
    nombreApoderado: 'Juan Pérez',
    telefonoApoderado: '+56967890124',
    correoApoderado: 'juan.perez@gmail.com',
    estadoMatricula: 'activo',
    fechaIngreso: '2024-03-01',
    activo: true,
  },
  {
    rut: '78901234-5',
    nombre: 'Diego',
    apellido: 'Morales',
    correo: 'apoderado.diego@gmail.com',
    password: 'Alumno123!',
    telefono: '+56978901234',
    rol: 'alumno',
    curso: 'Prekinder',
    fechaNacimiento: '2020-08-22',
    direccion: 'Calle Las Flores 456, Santiago',
    nombreApoderado: 'Carmen Morales',
    telefonoApoderado: '+56978901235',
    correoApoderado: 'carmen.morales@gmail.com',
    estadoMatricula: 'activo',
    fechaIngreso: '2024-03-01',
    activo: true,
  },
];

// Comunicaciones
const comunicaciones = [
  // Anuncios
  {
    id: 'anuncio-001',
    timestamp: '2024-03-01T10:00:00Z',
    tipo: 'anuncio',
    fecha: '2024-03-01',
    titulo: 'Inicio del año escolar 2024',
    contenido: 'Les damos la bienvenida a todos nuestros alumnos y familias al nuevo año escolar.',
    autor: '12345678-9',
    destinatarios: ['todos'],
    prioridad: 'alta',
  },
  {
    id: 'anuncio-002',
    timestamp: '2024-03-05T14:30:00Z',
    tipo: 'anuncio',
    fecha: '2024-03-05',
    titulo: 'Reunión de apoderados',
    contenido: 'Se llevará a cabo la primera reunión de apoderados el 15 de marzo a las 18:00 hrs.',
    autor: '23456789-0',
    destinatarios: ['Kinder', 'Prekinder'],
    prioridad: 'media',
  },
  // Eventos
  {
    id: 'evento-001',
    timestamp: '2024-03-10T09:00:00Z',
    tipo: 'evento',
    fecha: '2024-03-25',
    titulo: 'Día de la familia',
    contenido: 'Celebración del día de la familia con actividades recreativas.',
    lugar: 'Patio principal',
    horaInicio: '10:00',
    horaFin: '13:00',
    organizador: '12345678-9',
    destinatarios: ['todos'],
  },
  // Matrículas
  {
    id: 'matricula-001',
    timestamp: '2024-02-15T10:00:00Z',
    tipo: 'matricula',
    fecha: '2024-02-15',
    rutAlumno: '67890123-4',
    nombreAlumno: 'Sofía Pérez',
    curso: 'Kinder',
    nombreApoderado: 'Juan Pérez',
    telefonoApoderado: '+56967890124',
    correoApoderado: 'juan.perez@gmail.com',
    estado: 'aprobada',
  },
];

// Asistencias (última semana)
const asistencias = [];
const fechasAsistencia = ['2024-03-18', '2024-03-19', '2024-03-20', '2024-03-21', '2024-03-22'];
fechasAsistencia.forEach((fecha, index) => {
  asistencias.push({
    id: `asist-sofia-${fecha}`,
    curso: 'Kinder',
    fecha: fecha,
    rutAlumno: '67890123-4',
    nombreAlumno: 'Sofía Pérez',
    estado: index < 4 ? 'presente' : 'ausente',
    observaciones: index === 4 ? 'Justificado por cita médica' : '',
    registradoPor: '23456789-0',
  });
});

// Recursos académicos
const recursosAcademicos = [
  // Notas
  {
    id: 'nota-sofia-mat-001',
    tipo: 'nota',
    rutAlumno: '67890123-4',
    nombreAlumno: 'Sofía Pérez',
    curso: 'Kinder',
    asignatura: 'Matemáticas',
    fecha: '2024-03-15',
    calificacion: 6.5,
    evaluacion: 'Reconocimiento de números',
    profesor: '23456789-0',
  },
  // Materiales
  {
    id: 'material-001',
    tipo: 'material',
    curso: 'Kinder',
    asignatura: 'Matemáticas',
    titulo: 'Guía de números del 1 al 20',
    descripcion: 'Ejercicios de reconocimiento y escritura de números',
    fecha: '2024-03-10',
    profesor: '23456789-0',
    urlArchivo: 's3://boyhappy-materiales/matematicas-kinder-001.pdf',
  },
];

// Retroalimentación
const retroalimentacion = [
  {
    rutUsuario: '67890123-4',
    timestamp: '2024-03-15T10:30:00Z',
    origen: 'profesor',
    fecha: '2024-03-15',
    nombreProfesor: 'Carlos Ramírez',
    rutProfesor: '23456789-0',
    asignatura: 'Matemáticas',
    comentario: 'Sofía muestra excelente comprensión de los números. ¡Sigue adelante!',
    categoria: 'positiva',
  },
];

// Agenda fonoaudiología
const agendaFono = [
  {
    fechaHora: '2024-03-25T10:00:00',
    rutAlumno: '78901234-5',
    nombreAlumno: 'Diego Morales',
    rutFono: '45678901-2',
    nombreFono: 'Patricia Muñoz',
    motivo: 'Evaluación de articulación',
    estado: 'confirmada',
  },
];

// ========================================
// FUNCIONES AUXILIARES
// ========================================

async function crearUsuarioEnCognito(usuario) {
  try {
    // 1. Crear usuario
    await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: usuario.correo,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: usuario.password,
      UserAttributes: [
        { Name: 'email', Value: usuario.correo },
        { Name: 'email_verified', Value: 'true' }
      ]
    }));
    console.log(`   ✓ Creado en Cognito: ${usuario.nombre} ${usuario.apellido}`);
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`   ⚠️  Ya existe: ${usuario.nombre} ${usuario.apellido}`);
    } else {
      throw error;
    }
  }

  // 2. Establecer contraseña permanente
  try {
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: usuario.correo,
      Password: usuario.password,
      Permanent: true
    }));
  } catch (error) {
    console.log(`   ⚠️  Error al establecer contraseña para ${usuario.correo}: ${error.message}`);
  }

  // 3. Agregar a grupo
  try {
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: usuario.correo,
      GroupName: usuario.rol
    }));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`   ⚠️  Grupo '${usuario.rol}' no existe`);
    }
  }
}

async function batchWriteToDynamoDB(tableName, items) {
  if (items.length === 0) return;

  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } }))
      }
    }));
    process.stdout.write(`\r  ${tableName}: ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
  }
  console.log(' ✓');
}

// ========================================
// SCRIPT PRINCIPAL
// ========================================

async function seed() {
  console.log('\n🌱 BoyHappy - Script de Seeding Completo\n');
  console.log(`📋 User Pool ID: ${USER_POOL_ID}\n`);

  try {
    // PASO 1: Crear usuarios en Cognito
    console.log('👤 Creando usuarios en AWS Cognito...\n');
    for (const usuario of usuariosData) {
      await crearUsuarioEnCognito(usuario);
    }

    // PASO 2: Insertar datos en DynamoDB
    console.log('\n💾 Insertando datos en DynamoDB...\n');

    // Preparar usuarios sin contraseña
    const usuariosParaDDB = usuariosData.map(({ password, ...user }) => user);

    await batchWriteToDynamoDB('Usuarios', usuariosParaDDB);
    await batchWriteToDynamoDB('Comunicaciones', comunicaciones);
    await batchWriteToDynamoDB('Asistencia', asistencias);
    await batchWriteToDynamoDB('RecursosAcademicos', recursosAcademicos);
    await batchWriteToDynamoDB('Retroalimentacion', retroalimentacion);
    await batchWriteToDynamoDB('AgendaFonoaudiologia', agendaFono);

    // PASO 3: Guardar credenciales
    const credenciales = {
      generado: new Date().toISOString(),
      nota: 'IMPORTANTE: Estas contraseñas son permanentes. Guárdalas en un lugar seguro.',
      usuarios: usuariosData.map(u => ({
        rol: u.rol,
        nombre: `${u.nombre} ${u.apellido}`,
        correo: u.correo,
        password: u.password,
        rut: u.rut
      }))
    };

    const outputPath = path.join(__dirname, 'credenciales-seed.json');
    fs.writeFileSync(outputPath, JSON.stringify(credenciales, null, 2));

    // RESUMEN
    console.log('\n✅ Seeding completado exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   • ${usuariosParaDDB.length} usuarios (Cognito + DynamoDB)`);
    console.log(`   • ${comunicaciones.length} comunicaciones`);
    console.log(`   • ${asistencias.length} asistencias`);
    console.log(`   • ${recursosAcademicos.length} recursos académicos`);
    console.log(`   • ${retroalimentacion.length} retroalimentaciones`);
    console.log(`   • ${agendaFono.length} citas fonoaudiológicas`);
    console.log(`\n📝 Credenciales guardadas en: ${outputPath}\n`);

    console.log('🔐 Credenciales de acceso:\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    credenciales.usuarios.forEach(u => {
      console.log(`${u.rol.toUpperCase().padEnd(10)} | ${u.correo.padEnd(35)} | ${u.password}`);
    });
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.\n');

  } catch (error) {
    console.error('\n❌ Error durante el seeding:', error);
    process.exit(1);
  }
}

// Ejecutar
seed();
