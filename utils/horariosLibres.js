const moment = require('moment');
const db = require('../config/database');

function generarHorariosLibres(fecha, citas, opciones = {}) {
    const horariosLibres = [];

    const fechaBase = moment(fecha, 'YYYY-MM-DD', true);
    if (!fechaBase.isValid()) {
        console.error(`La fecha proporcionada no es válida: ${fecha}`);
        return horariosLibres;
    }

    const inicioMañana = opciones.inicioMañana || 8;
    const finMañana = opciones.finMañana || 12;
    const inicioTarde = opciones.inicioTarde || 14;
    const finTarde = opciones.finTarde || 18;
    const intervalo = opciones.intervalo || 40;

    const diasLaborales = opciones.diasLaborales || [1, 2, 3, 4, 5];
    const feriados = opciones.feriados || [];

    const diaSemana = fechaBase.day();

    if (!diasLaborales.includes(diaSemana)) {
        console.log(`Día ${fecha} bloqueado por no laboral`);
        return horariosLibres;
    }

    if (feriados.includes(fechaBase.format('YYYY-MM-DD'))) {
        console.log(`Fecha ${fecha} bloqueada por feriado`);
        return horariosLibres;
    }

    const crearBloque = (horaInicio, horaFin) => {
        for (let hora = horaInicio; hora < horaFin; hora++) {
            for (let minuto = 0; minuto < 60; minuto += intervalo) {

                const horaFormateada = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;

                const startISO = `${fechaBase.format('YYYY-MM-DD')}T${horaFormateada}:00Z`;

                horariosLibres.push({
                    id: `free-${fechaBase.format('YYYYMMDD')}-${hora}-${minuto}`,
                    fecha: fechaBase.format('YYYY-MM-DD'),
                    hora: horaFormateada,
                    startISO,
                    estado: "Disponible"
                });

            }
        }
    };

    crearBloque(inicioMañana, finMañana);
    crearBloque(inicioTarde, finTarde);

    const ocupados = new Set(
        citas.map(c => {
            let f;

            if (c.fechaHora instanceof Date) {
                f = c.fechaHora;
            }
            else if (typeof c.fechaHora === 'string') {
                const normalizado = c.fechaHora.replace(
                    /^(\d{2})\/(\d{2})\/(\d{4})/,
                    '$3-$2-$1'
                );
                f = new Date(normalizado);
            }
            else {
                f = new Date(c.fechaHora);
            }

            return f.toISOString().slice(11, 16);
        })
    );

    const filtrados = horariosLibres.filter(
        h => !ocupados.has(h.hora)
    );

    return filtrados;
}

function agregarHorarioLibre(idMedico, fechaHora, callback) {
    const sql = 'INSERT INTO horarios_libres (idMedico, fechaHora) VALUES (?, ?)';
    db.query(sql, [idMedico, fechaHora], (error, results) => {
        if (error) {
            console.error('Error al agregar horario libre:', error);
            return callback(error);
        }
        callback(null, results);
    });
}

function eliminarHorarioLibre(idMedico, fechaHora, callback) {
    const sql = 'DELETE FROM horarios_libres WHERE idMedico = ? AND fechaHora = ?';
    db.query(sql, [idMedico, fechaHora], (error, results) => {
        if (error) {
            console.error('Error al eliminar horario libre:', error);
            return callback(error);
        }
        if (results.affectedRows === 0) {
            console.log('No se encontró el horario para eliminar.');
            return callback(null, { message: 'No se encontró el horario para eliminar' });
        }
        console.log('Horario eliminado con éxito:', results);
        callback(null, results);
    });
}

module.exports = {
    generarHorariosLibres,
    agregarHorarioLibre,
    eliminarHorarioLibre
};
