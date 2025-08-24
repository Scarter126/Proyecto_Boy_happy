exports.handler = async (event) => {
  console.log(event); // útil para depurar

  const path = event.path; // /prod/login/profesores
  let body = '';

  if (path.endsWith('/admin')) {
    body = '<h1>Portal Admin / Rectora</h1>';
  } else if (path.endsWith('/profesores')) {
    body = '<h1>Portal Profesores</h1>';
  } else if (path.endsWith('/alumnos')) {
    body = '<h1>Portal Alumnos</h1>';
  } else {
    body = '<h1>Login</h1>';
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body,
  };
};
