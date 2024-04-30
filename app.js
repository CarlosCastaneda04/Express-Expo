const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Configurar el middleware para parsear el cuerpo de las solicitudes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar el middleware para sesiones
app.use(session({
    secret: 'mi_secreto',
    resave: false,
    saveUninitialized: true
}));

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Configurar la ruta para las vistas
app.set('views', __dirname);


// Configurar la conexión a la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'usuarios',
    password: '1704',
    port: 5432,
});

// Define una ruta GET para la ruta "/"
app.get('/', (req, res) => {
    res.send('¡Bienvenido a mi aplicación!');
});

// Define una ruta GET para la ruta "/registro"
app.get('/registro', (req, res) => {
    res.sendFile(__dirname + '/registro.html'); // Envía el archivo registro.html al cliente
});

// Define una ruta GET para la ruta "/inicio-sesion"
app.get('/inicio-sesion', (req, res) => {
    res.sendFile(__dirname + '/inicio-sesion.html'); // Envía el archivo inicio-sesion.html al cliente
});



// Ruta para el registro de usuarios
app.post('/registro', async (req, res) => {
    const { nombre_usuario, correo_electronico, contraseña } = req.body;

    // Imprimir los datos recibidos en la consola del servidor
    console.log('Datos recibidos del formulario:', req.body);

    try {
        // Verificar si el nombre de usuario ya está en uso
        const nombreUsuarioExistente = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [nombre_usuario]);
        if (nombreUsuarioExistente.rows.length > 0) {
            return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
        }

        // Verificar si el correo electrónico ya está en uso
        const correoExistente = await pool.query('SELECT * FROM usuarios WHERE correo_electronico = $1', [correo_electronico]);
        if (correoExistente.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
        }

        // Insertar el nuevo usuario en la base de datos
        const nuevoUsuario = await pool.query('INSERT INTO usuarios (nombre_usuario, correo_electronico, contraseña) VALUES ($1, $2, $3) RETURNING *', [nombre_usuario, correo_electronico, contraseña]);

        res.status(201).json({ message: 'Usuario registrado correctamente', usuario: nuevoUsuario.rows[0] });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ error: 'Se produjo un error al procesar la solicitud' });
    }
});

// Ruta para el inicio de sesión de usuarios
app.post('/inicio-sesion', async (req, res) => {
    const { nombre_usuario, contraseña } = req.body;

    try {
        // Verificar si el nombre de usuario existe en la base de datos
        const usuario = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [nombre_usuario]);
        if (usuario.rows.length === 0) {
            return res.status(404).json({ error: 'El nombre de usuario no existe' });
        }

        // Verificar si la contraseña proporcionada coincide con la almacenada para ese usuario
        if (usuario.rows[0].contraseña !== contraseña) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // Iniciar sesión almacenando el nombre de usuario en la sesión
        req.session.nombre_usuario = nombre_usuario;

        // Redirigir a la página de inicio
        res.redirect('/home');
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Se produjo un error al procesar la solicitud' });
    }
});

// Ruta para la página de inicio
app.get('/home', (req, res) => {
    // Verificar si el usuario ha iniciado sesión
    if (!req.session.nombre_usuario) {
        res.redirect('/inicio-sesion.html'); // Redirigir al inicio de sesión si no hay una sesión activa
    } else {
        // Obtener el nombre de usuario y correo electrónico del usuario desde la sesión
        const nombre_usuario = req.session.nombre_usuario;
        const correo_electronico = req.session.correo_electronico;
        
        // Renderizar la página home y pasar el nombre de usuario y correo electrónico como variables
        res.render('home', { nombre_usuario, correo_electronico });
    }
});


// Ruta para eliminar usuario
app.post('/eliminar-usuario', async (req, res) => {
    const { nombre_usuario } = req.session; // Obtener el nombre de usuario de la sesión

    try {
        // Eliminar el usuario de la base de datos
        const resultado = await pool.query('DELETE FROM usuarios WHERE nombre_usuario = $1', [nombre_usuario]);

        // Verificar si se eliminó algún usuario
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'No se encontró ningún usuario para eliminar' });
        }

        // Envía una respuesta exitosa si la eliminación fue exitosa
        res.status(200).json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Se produjo un error al procesar la solicitud' });
    }
});

// Ruta para editar usuario
app.post('/editar-usuario', async (req, res) => {
    try {
        // Obtener los datos del formulario de edición
        const { nombre_usuario, correo_electronico, contraseña } = req.body;

        // Realizar las operaciones necesarias para actualizar los datos del usuario en la base de datos
        const resultado = await pool.query('UPDATE usuarios SET correo_electronico = $1, contraseña = $2 WHERE nombre_usuario = $3', [correo_electronico, contraseña, nombre_usuario]);

        // Verificar si se actualizó algún usuario
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'No se encontró ningún usuario para actualizar' });
        }

        // Enviar una respuesta exitosa si la actualización fue exitosa
        res.redirect('/inicio-sesion');
    } catch (error) {
        console.error('Error al editar usuario:', error);
        // Verificar si el error es debido a una clave duplicada de correo electrónico
        if (error.constraint === 'usuarios_correo_electronico_key') {
            // Mostrar una alerta con el mensaje específico
            const errorMessage = `El correo electrónico "${req.body.correo_electronico}" ya está en uso. Por favor, ingrese otro correo electrónico.`;
            const script = `<script>alert('${errorMessage}'); window.location.href = '/home';</script>`;
            return res.send(script);
        } else {
            // Si el error no es de clave duplicada, mostrar una alerta genérica
            const errorMessage = 'Se produjo un error al procesar la solicitud.';
            const script = `<script>alert('${errorMessage}'); window.location.href = '/home';</script>`;
            return res.send(script);
        }
    }
});





// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
