/**
 * Script Completo de Seeding para BoyHappy - VERSIÓN MEJORADA
 *
 * Este script realiza:
 * 1. Crea usuarios en AWS Cognito con contraseñas permanentes
 * 2. Asigna usuarios a sus grupos correspondientes (admin, profesor, fono, alumno)
 * 3. Inserta datos seed en DynamoDB con datos realistas y relacionados
 * 4. Guarda las credenciales en un archivo JSON
 *
 * Datos generados:
 * - 15 usuarios (1 admin, 3 profesores, 2 fonos, 10 alumnos)
 * - Configuración del sistema
 * - Categorías de materiales
 * - ~15 comunicaciones
 * - ~200 asistencias (último mes)
 * - ~80 recursos académicos
 * - ~30 retroalimentaciones
 * - ~15 citas fonoaudiológicas
 *
 * Uso: node scripts/seed.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configurar Faker en español (Chile)
faker.locale = 'es';

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
// CONFIGURACIÓN CENTRALIZADA DE CURSOS
// ========================================

const CURSOS_CONFIG = [
  {
    codigo: 'medio-mayor',
    nombre: 'Medio Mayor',
    edadNacimiento: { min: '2021-01-01', max: '2021-12-31' },
    numAlumnos: 2
  },
  {
    codigo: 'prekinder-a',
    nombre: 'Prekínder A',
    edadNacimiento: { min: '2020-01-01', max: '2020-06-30' },
    numAlumnos: 3
  },
  {
    codigo: 'prekinder-b',
    nombre: 'Prekínder B',
    edadNacimiento: { min: '2020-07-01', max: '2020-12-31' },
    numAlumnos: 2
  },
  {
    codigo: 'kinder',
    nombre: 'Kínder',
    edadNacimiento: { min: '2019-01-01', max: '2019-12-31' },
    numAlumnos: 2
  },
  {
    codigo: 'extension',
    nombre: 'Extensión',
    edadNacimiento: { min: '2018-01-01', max: '2018-12-31' },
    numAlumnos: 1
  }
];

// Total de alumnos: 10

// ========================================
// FUNCIONES AUXILIARES PARA GENERAR DATOS
// ========================================

// Generar RUT chileno válido
function generarRUT() {
  const numero = faker.number.int({ min: 10000000, max: 25000000 });
  let suma = 0;
  let multiplicador = 2;

  let tempRut = numero;
  while (tempRut > 0) {
    suma += (tempRut % 10) * multiplicador;
    tempRut = Math.floor(tempRut / 10);
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dv = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);

  return `${numero}-${dv}`;
}

// Generar teléfono chileno
function generarTelefonoChileno() {
  return `+569${faker.number.int({ min: 10000000, max: 99999999 })}`;
}

// Generar correo desde nombre
function generarCorreo(nombre, apellido, dominio = 'gmail.com') {
  return `${nombre.toLowerCase()}.${apellido.toLowerCase()}@${dominio}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Generar fecha de nacimiento para niños según curso
function generarFechaNacimiento(curso) {
  return faker.date.between({
    from: curso.edadNacimiento.min,
    to: curso.edadNacimiento.max
  }).toISOString().split('T')[0];
}

// ========================================
// DATOS SEED - USUARIOS (desde credenciales-seed.json)
// ========================================

// Cargar usuarios desde archivo JSON
const credencialesPath = path.join(__dirname, 'credenciales-seed.json');
let usuariosCredenciales = [];

try {
  const credencialesData = JSON.parse(fs.readFileSync(credencialesPath, 'utf-8'));
  usuariosCredenciales = credencialesData.usuarios;
  console.log(`✅ Cargados ${usuariosCredenciales.length} usuarios desde credenciales-seed.json`);
} catch (error) {
  console.error('❌ Error al cargar credenciales-seed.json:', error.message);
  process.exit(1);
}

// Separar usuarios por rol
const admin = usuariosCredenciales.find(u => u.rol === 'admin');
if (!admin) {
  console.error('❌ Error: No se encontró usuario admin en credenciales-seed.json');
  process.exit(1);
}

// Agregar campos adicionales al admin
admin.fechaIngreso = '2024-01-01';
admin.cargo = 'Directora';
admin.activo = true;
admin.apellido = admin.nombre.split(' ').slice(1).join(' ') || 'Admin';
admin.nombre = admin.nombre.split(' ')[0];
admin.telefono = admin.telefono || generarTelefonoChileno();

// PROFESORES (desde credenciales-seed.json)
const profesoresCredenciales = usuariosCredenciales.filter(u => u.rol === 'profesor');
const profesores = [];
const especialidadesProfesores = [
  ['Matemáticas', 'Ciencias'],
  ['Lenguaje', 'Artes'],
  ['Educación Física', 'Música']
];
const cursosAsignadosProfesores = [
  ['kinder', 'prekinder-a', 'prekinder-b'],
  ['kinder', 'medio-mayor'],
  ['prekinder-a', 'prekinder-b', 'extension']
];
const titulosProfesores = [
  'Profesor de Educación General Básica',
  'Profesor de Educación Parvularia',
  'Profesor de Educación Física'
];

profesoresCredenciales.forEach((prof, i) => {
  const nombreCompleto = prof.nombre.split(' ');
  profesores.push({
    rut: prof.rut,
    nombre: nombreCompleto[0],
    apellido: nombreCompleto.slice(1).join(' ') || 'Profesor',
    correo: prof.correo,
    password: prof.password,
    telefono: prof.telefono || generarTelefonoChileno(),
    rol: 'profesor',
    especialidad: especialidadesProfesores[i % especialidadesProfesores.length].join(', '),
    cursosAsignados: cursosAsignadosProfesores[i % cursosAsignadosProfesores.length],
    fechaIngreso: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    titulo: titulosProfesores[i % titulosProfesores.length],
    activo: true,
  });
});

// FONOAUDIÓLOGOS (desde credenciales-seed.json)
const fonosCredenciales = usuariosCredenciales.filter(u => u.rol === 'fono');
const fonos = [];
const especialidadesFonos = [
  'Trastornos del Lenguaje',
  'Dificultades de Aprendizaje'
];
const horariosAtencion = [
  'Lunes a Viernes 9:00-17:00',
  'Lunes a Viernes 10:00-18:00'
];

fonosCredenciales.forEach((fono, i) => {
  const nombreCompleto = fono.nombre.split(' ');
  fonos.push({
    rut: fono.rut,
    nombre: nombreCompleto[0],
    apellido: nombreCompleto.slice(1).join(' ') || 'Fono',
    correo: fono.correo,
    password: fono.password,
    telefono: fono.telefono || generarTelefonoChileno(),
    rol: 'fono',
    especialidad: especialidadesFonos[i % especialidadesFonos.length],
    fechaIngreso: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    titulo: 'Fonoaudiólogo',
    horarioAtencion: horariosAtencion[i % horariosAtencion.length],
    activo: true,
  });
});

// ALUMNOS (desde credenciales-seed.json)
const alumnosCredenciales = usuariosCredenciales.filter(u => u.rol === 'alumno');
const alumnos = [];

// Distribuir alumnos entre los cursos
alumnosCredenciales.forEach((alumno, i) => {
  const curso = CURSOS_CONFIG[i % CURSOS_CONFIG.length];
  const nombreCompleto = alumno.nombre.split(' ');
  const nombreApoderado = faker.person.fullName();

  alumnos.push({
    rut: alumno.rut,
    nombre: nombreCompleto[0],
    apellido: nombreCompleto.slice(1).join(' ') || 'Alumno',
    correo: alumno.correo,
    password: alumno.password,
    telefono: alumno.telefono || generarTelefonoChileno(),
    rol: 'alumno',
    curso: curso.codigo,
    cursoNombre: curso.nombre,
    fechaNacimiento: generarFechaNacimiento(curso),
    direccion: `${faker.location.streetAddress()}, Santiago`,
    nombreApoderado: nombreApoderado,
    telefonoApoderado: generarTelefonoChileno(),
    correoApoderado: generarCorreo(nombreApoderado.split(' ')[0], nombreApoderado.split(' ')[1] || 'Familia'),
    estadoMatricula: 'activo',
    fechaIngreso: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    activo: true,
  });
});

// Combinar todos los usuarios
const usuariosData = [
  admin,
  ...profesores,
  ...fonos,
  ...alumnos
];

// ========================================
// CONFIGURACIÓN DEL SISTEMA
// ========================================

const configuracion = [
  {
    id: 'cursos',
    tipo: 'cursos',
    cursos: CURSOS_CONFIG.map(c => c.codigo),
    cursosNombres: CURSOS_CONFIG.map(c => ({ codigo: c.codigo, nombre: c.nombre })),
    descripcion: 'Cursos disponibles en el sistema'
  },
  {
    id: 'periodo-academico',
    tipo: 'periodo',
    anio: 2025,
    fechaInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fechaTermino: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: 'Período académico actual'
  },
  {
    id: 'dias-clase',
    tipo: 'horarios',
    diasClase: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    horaInicio: '08:00',
    horaTermino: '17:00',
    descripcion: 'Días y horarios de clase'
  },
  {
    id: 'asignaturas',
    tipo: 'asignaturas',
    asignaturas: ['Matemáticas', 'Lenguaje', 'Ciencias', 'Artes', 'Educación Física', 'Música'],
    descripcion: 'Asignaturas impartidas'
  },
  {
    id: 'notificaciones',
    tipo: 'notificaciones',
    emailEnabled: true,
    emailFrom: 'notificaciones@boyhappy.cl',
    descripcion: 'Configuración de notificaciones'
  }
];

// ========================================
// CATEGORÍAS DE MATERIALES
// ========================================

const categorias = [
  {
    id: 'categoria-guias',
    tipo: 'categoria',
    nombre: 'Guías de Trabajo',
    descripcion: 'Guías y fichas de trabajo para alumnos',
    color: '#4CAF50',
    icono: 'fa-file-alt',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'categoria-presentaciones',
    tipo: 'categoria',
    nombre: 'Presentaciones',
    descripcion: 'Presentaciones PowerPoint y similares',
    color: '#FF6B35',
    icono: 'fa-presentation',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'categoria-videos',
    tipo: 'categoria',
    nombre: 'Videos Educativos',
    descripcion: 'Material audiovisual educativo',
    color: '#2196F3',
    icono: 'fa-video',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'categoria-lecturas',
    tipo: 'categoria',
    nombre: 'Material de Lectura',
    descripcion: 'Libros, cuentos y material de lectura',
    color: '#9C27B0',
    icono: 'fa-book',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'categoria-evaluaciones',
    tipo: 'categoria',
    nombre: 'Evaluaciones',
    descripcion: 'Pruebas y evaluaciones',
    color: '#FDB927',
    icono: 'fa-clipboard-check',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'categoria-general',
    tipo: 'categoria',
    nombre: 'Recursos Generales',
    descripcion: 'Otros recursos pedagógicos',
    color: '#607D8B',
    icono: 'fa-folder',
    tipoRecurso: 'material',
    activa: true,
    timestamp: '2024-01-01T00:00:00Z'
  }
];

// ========================================
// COMUNICACIONES
// ========================================

const comunicaciones = [];

// ===== ANUNCIOS (5 con Faker) =====
const titulosAnuncios = [
  'Inicio del año escolar 2024',
  'Reunión de apoderados',
  'Suspensión de clases por feriado',
  'Taller de padres',
  'Actualización de lista de útiles'
];
const contenidosAnuncios = [
  'Les damos la bienvenida a todos nuestros alumnos y familias al nuevo año escolar. Estamos muy contentos de recibirlos.',
  'Se llevará a cabo la primera reunión de apoderados el 15 de marzo a las 18:00 hrs.',
  'Recordamos que el lunes 18 de marzo no habrá clases por feriado nacional.',
  'Invitamos a todos los apoderados al taller "Apoyo en casa" el sábado 23 de marzo a las 10:00 hrs.',
  'Por favor revisar la lista de útiles actualizada en el portal web.'
];
const prioridades = ['alta', 'media', 'alta', 'media', 'baja'];
const autoresAnuncios = [admin.rut, profesores[0].rut, admin.rut, profesores[1].rut, profesores[0].rut];

for (let i = 0; i < 5; i++) {
  comunicaciones.push({
    id: `anuncio-${String(i + 1).padStart(3, '0')}`,
    timestamp: faker.date.recent({ days: 365 }).toISOString(),
    tipo: 'anuncio',
    fecha: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    titulo: titulosAnuncios[i],
    contenido: contenidosAnuncios[i],
    autor: autoresAnuncios[i],
    destinatarios: i % 2 === 0 ? ['todos'] : CURSOS_CONFIG.slice(0, 2).map(c => c.codigo),
    prioridad: prioridades[i],
  });
}

// ===== EVENTOS (5 con Faker) =====
const titulosEventos = ['Día de la familia', 'Semana del libro', 'Feria de ciencias', 'Día del deporte', 'Festival de música'];
const lugaresEventos = ['Patio principal', 'Biblioteca', 'Gimnasio', 'Cancha deportiva', 'Auditorio'];

for (let i = 0; i < 5; i++) {
  comunicaciones.push({
    id: `evento-${String(i + 1).padStart(3, '0')}`,
    timestamp: faker.date.recent({ days: 365 }).toISOString(),
    tipo: 'evento',
    fecha: faker.date.soon({ days: 90 }).toISOString().split('T')[0],
    titulo: titulosEventos[i],
    contenido: `${titulosEventos[i]} - ${faker.lorem.sentence()}`,
    lugar: lugaresEventos[i],
    horaInicio: '10:00',
    horaFin: '13:00',
    organizador: i % 2 === 0 ? admin.rut : profesores[i % profesores.length].rut,
    destinatarios: ['todos'],
  });
}

// ===== MATRÍCULAS (una por cada alumno con datos dinámicos) =====
alumnos.forEach((alumno, idx) => {
  comunicaciones.push({
    id: `matricula-${String(idx + 1).padStart(3, '0')}`,
    timestamp: faker.date.recent({ days: 365 }).toISOString(),
    tipo: 'matricula',
    fecha: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    curso: alumno.curso,
    nombreApoderado: alumno.nombreApoderado,
    telefonoApoderado: alumno.telefonoApoderado,
    correoApoderado: alumno.correoApoderado,
    estado: 'aprobada',
  });
});

// ========================================
// ASISTENCIAS (último año - ~800 registros)
// ========================================

const asistencias = [];

// Función auxiliar para generar estado aleatorio (mayormente presentes)
function getEstadoAsistencia() {
  return faker.helpers.weightedArrayElement([
    { weight: 7, value: 'presente' },
    { weight: 2, value: 'ausente' },
    { weight: 0.5, value: 'atrasado' },
    { weight: 0.5, value: 'justificado' }
  ]);
}

// Generar ~800 asistencias distribuidas en el último año
for (let i = 0; i < 800; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);
  const estado = getEstadoAsistencia();
  const fecha = faker.date.recent({ days: 365 }).toISOString().split('T')[0];

  asistencias.push({
    id: `asist-${alumno.rut}-${fecha}-${i}`,
    curso: alumno.curso,
    fecha: fecha,
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    estado: estado,
    observaciones: estado === 'ausente' || estado === 'justificado' ? 'Justificado por apoderado' : '',
    registradoPor: faker.helpers.arrayElement(profesores).rut,
    timestamp: faker.date.recent({ days: 365 }).toISOString()
  });
}

// ========================================
// RECURSOS ACADÉMICOS
// ========================================

const recursosAcademicos = [];

// ===== NOTAS (~500 registros con niveles de logro) =====
const asignaturas = ['Matemáticas', 'Lenguaje', 'Ciencias', 'Artes', 'Educación Física', 'Música'];
const nivelesLogro = ['L', 'OD', 'NL', 'NT'];
const evaluaciones = [
  'Reconocimiento de números', 'Sumas básicas', 'Figuras geométricas',
  'Comprensión lectora', 'Escritura de vocales', 'Dictado',
  'Experimento de plantas', 'Ciclo del agua',
  'Dibujo y pintura', 'Manualidades', 'Coordinación motriz', 'Ritmos musicales'
];

for (let i = 0; i < 500; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);
  const asignatura = faker.helpers.arrayElement(asignaturas);
  const calificacion = faker.number.float({ min: 4.0, max: 7.0, precision: 0.1 });
  const nivelLogro = faker.helpers.arrayElement(nivelesLogro);

  recursosAcademicos.push({
    id: `nota-${faker.string.uuid()}`,
    tipo: 'nota',
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    curso: alumno.curso,
    asignatura: asignatura,
    fecha: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    calificacion: calificacion,
    nivelLogro: nivelLogro,
    evaluacion: faker.helpers.arrayElement(evaluaciones),
    profesor: faker.helpers.arrayElement(profesores).rut,
    timestamp: faker.date.recent({ days: 365 }).toISOString()
  });
}

// ===== MATERIALES (~150 registros) =====
const categoriasMateriales = [
  'categoria-guias', 'categoria-presentaciones', 'categoria-videos',
  'categoria-lecturas', 'categoria-evaluaciones', 'categoria-general'
];
const titulosMateriales = [
  'Guía de trabajo', 'Presentación multimedia', 'Video educativo',
  'Fichas de práctica', 'Material de lectura', 'Evaluación',
  'Recursos generales', 'Actividades prácticas'
];

for (let i = 0; i < 150; i++) {
  const curso = faker.helpers.arrayElement(CURSOS_CONFIG);
  const asignatura = faker.helpers.arrayElement(asignaturas);
  const categoria = faker.helpers.arrayElement(categoriasMateriales);
  const titulo = `${faker.helpers.arrayElement(titulosMateriales)} - ${asignatura}`;

  recursosAcademicos.push({
    id: `material-${faker.string.uuid()}`,
    tipo: 'material',
    curso: curso.codigo,
    asignatura: asignatura,
    titulo: titulo,
    descripcion: `Material pedagógico para ${asignatura} - ${curso.nombre}`,
    fechaSubida: faker.date.recent({ days: 365 }).toISOString(),
    profesor: faker.helpers.arrayElement(profesores).rut,
    urlArchivo: `s3://boyhappy-materiales/${curso.codigo}-${asignatura.toLowerCase()}-${i}.pdf`,
    categoria: categoria,
    unidad: `Unidad ${faker.number.int({ min: 1, max: 4 })}`,
    estado: faker.helpers.weightedArrayElement([
      { weight: 8, value: 'aprobado' },
      { weight: 1, value: 'pendiente' },
      { weight: 1, value: 'en_correccion' }
    ]),
    timestamp: faker.date.recent({ days: 365 }).toISOString()
  });
}

// ===== BITÁCORAS (~100 registros) =====
const categoriasBitacora = ['Conducta', 'Aprendizaje', 'Social', 'Emocional', 'Comunicación'];
const severidades = ['leve', 'moderada', 'alta'];
const descripcionesBitacora = [
  'Excelente participación en clase',
  'Dificultad para mantener atención',
  'Comparte materiales con compañeros',
  'Muestra timidez al participar',
  'Comunica sus necesidades claramente',
  'Requiere apoyo en lectoescritura',
  'Demuestra liderazgo en actividades grupales',
  'Se distrae con facilidad',
  'Expresa emociones de forma adecuada',
  'Necesita refuerzo en matemáticas'
];

for (let i = 0; i < 100; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);

  recursosAcademicos.push({
    id: `bitacora-${faker.string.uuid()}`,
    tipo: 'bitacora',
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    curso: alumno.curso,
    fecha: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    categoria: faker.helpers.arrayElement(categoriasBitacora),
    severidad: faker.helpers.arrayElement(severidades),
    descripcion: faker.helpers.arrayElement(descripcionesBitacora),
    autor: faker.helpers.arrayElement(profesores).rut,
    timestamp: faker.date.recent({ days: 365 }).toISOString()
  });
}

// ===== SESIONES FONOAUDIOLÓGICAS (~100 registros) =====
const tiposSesion = ['Evaluación', 'Terapia', 'Seguimiento', 'Control'];
const duraciones = [30, 45, 60];

for (let i = 0; i < 100; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);
  const fono = faker.helpers.arrayElement(fonos);

  recursosAcademicos.push({
    id: `sesion-${faker.string.uuid()}`,
    tipo: 'sesion',
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    rutFono: fono.rut,
    nombreFono: `${fono.nombre} ${fono.apellido}`,
    fecha: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    tipoSesion: faker.helpers.arrayElement(tiposSesion),
    duracion: faker.helpers.arrayElement(duraciones),
    observaciones: faker.lorem.sentence(),
    timestamp: faker.date.recent({ days: 365 }).toISOString()
  });
}

// Total RecursosAcademicos: 500 notas + 150 materiales + 100 bitácoras + 100 sesiones = 850 items

// ========================================
// RETROALIMENTACIÓN
// ========================================

const retroalimentacion = [];
const tiposRetro = ['felicitacion', 'sugerencia', 'preocupacion', 'logro', 'recomendacion'];
const comentariosRetro = [
  'Excelente progreso en matemáticas. Sigue así.',
  'Recomiendo practicar la lectura en casa 15 minutos diarios.',
  'Ha mostrado timidez en clases. Trabajaremos la confianza.',
  'Gran logro: reconoce todas las vocales.',
  'Sugiero reforzar la escritura del nombre.',
  'Felicitaciones por su esfuerzo en ciencias.',
  'Necesita apoyo en motricidad fina.',
  'Destaca en actividades artísticas.',
  'Preocupa su nivel de atención. Evaluaremos estrategias.',
  'Logró contar hasta 20 sin errores. ¡Excelente!'
];

const origenes = ['profesor', 'fono'];

// Generar ~80 retroalimentaciones
for (let i = 0; i < 80; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);
  const origen = faker.helpers.arrayElement(origenes);
  const tipo = faker.helpers.arrayElement(tiposRetro);

  let rutAutor, nombreAutor;
  if (origen === 'profesor') {
    const profesor = faker.helpers.arrayElement(profesores);
    rutAutor = profesor.rut;
    nombreAutor = `${profesor.nombre} ${profesor.apellido}`;
  } else {
    const fono = faker.helpers.arrayElement(fonos);
    rutAutor = fono.rut;
    nombreAutor = `${fono.nombre} ${fono.apellido}`;
  }

  const fecha = faker.date.recent({ days: 365 }).toISOString();

  retroalimentacion.push({
    rutUsuario: alumno.rut,
    timestamp: fecha,
    origen: origen,
    fecha: fecha.split('T')[0],
    nombreProfesor: origen === 'profesor' ? nombreAutor : undefined,
    rutProfesor: origen === 'profesor' ? rutAutor : undefined,
    nombreFono: origen === 'fono' ? nombreAutor : undefined,
    rutFono: origen === 'fono' ? rutAutor : undefined,
    asignatura: origen === 'profesor' ? faker.helpers.arrayElement(asignaturas) : undefined,
    comentario: faker.helpers.arrayElement(comentariosRetro),
    tipo: tipo,
    categoria: tipo, // Para compatibilidad
    visibilidad: faker.helpers.arrayElement(['publica', 'privada']),
    curso: alumno.curso
  });
}

// ========================================
// AGENDA FONOAUDIOLOGÍA
// ========================================

const agendaFono = [];
const estadosCita = ['confirmada', 'pendiente', 'completada', 'cancelada'];
const motivosCita = [
  'Evaluación de articulación',
  'Terapia de lenguaje',
  'Seguimiento mensual',
  'Evaluación inicial',
  'Terapia de pronunciación',
  'Control de avances',
  'Evaluación de comprensión',
  'Terapia grupal'
];

// Generar ~50 citas distribuidas en el último año
for (let i = 0; i < 50; i++) {
  const alumno = faker.helpers.arrayElement(alumnos);
  const fono = faker.helpers.arrayElement(fonos);
  const estado = faker.helpers.weightedArrayElement([
    { weight: 4, value: 'completada' },
    { weight: 2, value: 'confirmada' },
    { weight: 1, value: 'pendiente' },
    { weight: 0.5, value: 'cancelada' }
  ]);

  const fechaHora = faker.date.recent({ days: 365 }).toISOString().split('.')[0] + 'Z';

  agendaFono.push({
    fechaHora: fechaHora,
    rutAlumno: alumno.rut,
    nombreAlumno: `${alumno.nombre} ${alumno.apellido}`,
    rutFono: fono.rut,
    nombreFono: `${fono.nombre} ${fono.apellido}`,
    motivo: faker.helpers.arrayElement(motivosCita),
    estado: estado,
    observaciones: estado === 'completada' ? 'Sesión completada satisfactoriamente' : '',
    duracion: faker.helpers.arrayElement([30, 45, 60])
  });
}

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
  console.log('\n🌱 BoyHappy - Script de Seeding Completo (VERSIÓN MEJORADA)\n');
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
    await batchWriteToDynamoDB('Configuracion', configuracion);
    await batchWriteToDynamoDB('RecursosAcademicos', [...categorias, ...recursosAcademicos]);
    await batchWriteToDynamoDB('Comunicaciones', comunicaciones);
    await batchWriteToDynamoDB('Asistencia', asistencias);
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
    console.log(`   • ${configuracion.length} configuraciones del sistema`);
    console.log(`   • ${categorias.length} categorías de materiales`);
    console.log(`   • ${comunicaciones.length} comunicaciones`);
    console.log(`   • ${asistencias.length} asistencias`);
    console.log(`   • ${recursosAcademicos.length} recursos académicos`);
    console.log(`   • ${retroalimentacion.length} retroalimentaciones`);
    console.log(`   • ${agendaFono.length} citas fonoaudiológicas`);
    console.log(`\n📝 Credenciales guardadas en: ${outputPath}\n`);

    console.log('🔐 Credenciales de acceso:\n');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    credenciales.usuarios.forEach(u => {
      console.log(`${u.rol.toUpperCase().padEnd(10)} | ${u.correo.padEnd(40)} | ${u.password}`);
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.\n');

  } catch (error) {
    console.error('\n❌ Error durante el seeding:', error);
    process.exit(1);
  }
}

// Ejecutar
seed();
