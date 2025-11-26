// Verifica si el usuario está autenticado 
exports.isAuthenticated = (req, res, next) => {
    console.log('Verificando si está autenticado:', req.session.user);
    
    // Verificar si no hay sesión activa o si el usuario no tiene el atributo 'user'
    if (!req.session.user || !req.session.user.id) {
        console.log('Sesión no encontrada o usuario no autenticado, redirigiendo al login');
        return res.redirect('/login');
    }
    
    console.log('Autenticación verificada, procediendo...');
    next();
};

// Middleware para permitir acceso a administradores
exports.isAdmin = (req, res, next) => {
    console.log('Verificando acceso de administrador:', req.session.user); // Log para verificar el acceso
    if (req.session.user && req.session.user.role === 'administrador') {
        console.log('Acceso concedido a administrador:', req.session.user);
        return next();
    }
    console.log('Acceso denegado: Solo para administradores');
    return res.status(403).send('Acceso denegado: Solo para administradores');
};



// Middleware genérico para verificación de roles
exports.checkRole = (role) => {
    return (req, res, next) => {
        console.log(`Verificando rol de ${role}:`, req.session.user);
        
        // Log para verificar qué rol se está intentando verificar
        console.log('Rol esperado:', role);

        if (req.session.user) {
            console.log('Usuario autenticado:', req.session.user);
            if (req.session.user.role === role) {
                console.log(`Acceso concedido a ${role}:`, req.session.user);
                return next();
            } else {
                console.log(`Acceso denegado: El rol del usuario es ${req.session.user.role}, se esperaba ${role}`);
            }
        } else {
            console.log('No hay usuario autenticado, redirigiendo...');
        }

        return res.status(403).send(`Acceso denegado: Solo para ${role}s`);
    };
};


// Definición de middleware específicos para cada rol usando checkRole
exports.isMedico = exports.checkRole('medico');
exports.isSecretaria = exports.checkRole('secretaria');
exports.isPaciente = exports.checkRole('paciente');
exports.isAdministrador = exports.checkRole('administrador');
exports.isAdmin = exports.isAdministrador;


// Middleware para permitir acceso a pacientes y médicos
exports.isPacienteOrMedico = (req, res, next) => {
    const role = req.session.user?.role?.toLowerCase(); // 🔹 normaliza
    console.log('Verificando acceso de paciente o médico:', req.session.user);

    if (role === 'paciente' || role === 'medico') {
        console.log('Acceso concedido a paciente o médico:', req.session.user);
        return next();
    }

    console.log('Acceso denegado: Solo para pacientes o médicos');
    return res.status(403).send('Acceso denegado: Solo para pacientes o médicos');
};

// Middleware para permitir acceso a pacientes y secretarias
exports.isPacienteOrSecretaria = (req, res, next) => {
    console.log('Verificando acceso de paciente o secretaria:', req.session.user);
    if (req.session.user && (req.session.user.role === 'paciente' || req.session.user.role === 'secretaria')) {
        console.log('Acceso concedido a paciente o secretaria:', req.session.user);
        return next();
    }
    console.log('Acceso denegado: Solo para pacientes o secretarias');
    return res.status(403).send('Acceso denegado: Solo para pacientes o secretarias');
};
// Middleware para verificar si el paciente está pendiente de aprobación
exports.isPatientPending = (req, res, next) => {
    const idPaciente = req.session.user.id; // Obtener el ID del paciente desde la sesión

    const sql = 'SELECT estado FROM pacientes WHERE idPaciente = ?';
    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error('Error al verificar el estado del paciente:', error);
            return res.status(500).send('Error al verificar el estado del paciente');
        }

        if (results.length > 0 && results[0].estado === 'Pendiente') {
            // Si el paciente está en estado Pendiente, redirigirlo a la página de "Pacientes Pendientes"
            return res.redirect('/admin/pacientes-pendientes'); 
        }

        next(); // Si el paciente está aprobado, permite que continúe con la solicitud
    });
};
