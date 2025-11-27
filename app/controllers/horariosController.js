// app/controllers/horariosController.js
const db = require('../../config/database');

exports.validarFechaDisponible = (req, res) => {
    const { idMedico, fecha } = req.query; // fecha = YYYY-MM-DD

    if (!idMedico || !fecha) {
        return res.status(400).json({
            disponible: false,
            motivo: "Faltan parámetros"
        });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    if (fecha < hoy) {
        return res.json({
            disponible: false,
            motivo: "No podés elegir una fecha pasada"
        });
    }

    const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diaSemanaNombre = nombresDias[new Date(fecha).getDay()];

    const qFeriado = `SELECT id FROM dias_no_laborables WHERE fecha = ?`;

    db.query(qFeriado, [fecha], (errF, feriado) => {
        if (errF) return res.status(500).json({ disponible: false, motivo: "Error interno" });

        if (feriado.length > 0) {
            return res.json({
                disponible: false,
                motivo: "La fecha seleccionada es un día no laborable"
            });
        }

        const qVac = `
            SELECT idVacacion 
            FROM vacaciones 
            WHERE idMedico = ?
            AND ? BETWEEN fechaInicio AND fechaFin
        `;

        db.query(qVac, [idMedico, fecha], (errV, vac) => {
            if (errV) return res.status(500).json({ disponible: false, motivo: "Error interno" });

            if (vac.length > 0) {
                return res.json({
                    disponible: false,
                    motivo: "El médico está de vacaciones en esa fecha"
                });
            }

            const qHorario = `
                SELECT idHorarioEstandar 
                FROM horarios_estandar_medico
                WHERE idMedico = ?
                AND diaSemana = ?
            `;

            db.query(qHorario, [idMedico, diaSemanaNombre], (errH, horario) => {
                if (errH) return res.status(500).json({ disponible: false, motivo: "Error interno" });

                if (horario.length === 0) {
                    return res.json({
                        disponible: false,
                        motivo: "El médico no atiende ese día"
                    });
                }

                return res.json({ disponible: true });
            });
        });
    });
};

exports.obtenerHorariosLibres = (req, res) => {
    const idMedico = req.params.id;
    const fecha = req.query.fecha;

    console.log("📩 [REQ] obtenerHorariosLibres");
    console.log("  → idMedico:", idMedico);
    console.log("  → fecha:", fecha);

    if (!idMedico || !fecha) {
        return res.status(400).json({ error: "idMedico y fecha son obligatorios" });
    }

    const sql = `
        SELECT fechaHora
        FROM horarios_libres
        WHERE idMedico = ?
        AND DATE(fechaHora) = ?
        AND disponible = 1
        ORDER BY fechaHora ASC
    `;

    db.query(sql, [idMedico, fecha], (err, results) => {
        if (err) {
            console.error("❌ Error al obtener horarios libres:", err);
            return res.status(500).json({ error: "Error al obtener horarios libres" });
        }

        console.log("📤 [SQL] resultados crudos:", results);

        // Ahora devolvemos SOLO STRINGS como necesita tu Swal
        const horarios = results.map(r => r.fechaHora);

        console.log("📤 [RESP] horarios:", horarios);

        return res.json(horarios);
    });
};
