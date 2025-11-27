document.addEventListener('DOMContentLoaded', function () {        
  const calendarEl = document.getElementById('calendar');

  if (!calendarEl || typeof FullCalendar === 'undefined') {
    return;
  }

  let diasLaborales = [1, 2, 3, 4, 5];
  let feriados = [];

  if (calendarEl.dataset.diasLaborales) {
    try { diasLaborales = JSON.parse(calendarEl.dataset.diasLaborales); }
    catch (err) { diasLaborales = [1, 2, 3, 4, 5]; }
  }

  if (calendarEl.dataset.feriados) {
    try { feriados = JSON.parse(calendarEl.dataset.feriados); }
    catch (err) { feriados = []; }
  }

  const medicoId = calendarEl.dataset.medicoId;
  const role = calendarEl.dataset.role || "none";

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    timeZone: 'UTC',
    themeSystem: 'bootstrap5',
    initialView: 'dayGridMonth',

    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día'
    },

    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },

    selectable: false,
    weekNumbers: true,
    dayMaxEvents: true,

    eventContent: function (arg) {
      const color = arg.event.backgroundColor;
      return {
        html: `
          <div style="
            width:8px;
            height:8px;
            border-radius:50%;
            background:${color};
            margin:auto;
            margin-top:3px;
          "></div>
        `
      };
    },

    eventDidMount: function(info) {
      if (info.el) {
        info.el.style.background = "transparent";
        info.el.style.border = "none";
        info.el.style.height = "100%";
        info.el.style.width = "100%";
        info.el.style.position = "absolute";
        info.el.style.top = "0";
        info.el.style.left = "0";
        info.el.style.cursor = "pointer";
        info.el.style.zIndex = "5";
      }
    },

    events: function (info, successCallback, failureCallback) {
      if (!medicoId) return failureCallback("Falta ID médico");

      const params = new URLSearchParams({
        start: info.startStr,
        end: info.endStr,
        role: role
      });

      if (calendarEl.dataset.diasLaborales)
        params.append('diasLaboralesJSON', calendarEl.dataset.diasLaborales);

      if (calendarEl.dataset.feriados)
        params.append('feriadosJSON', calendarEl.dataset.feriados);

      fetch(`/medicos/${medicoId}/citas-json?${params}`)
        .then(res => res.json())
        .then(data => {
          let eventos = data;

          if (role === "paciente") {
            eventos = eventos.filter(ev => ev.extendedProps.estado === "Disponible");
          }

          const mapa = eventos.map(ev => {
            let color = "#0d6efd";

            if (ev.extendedProps?.tipoTurno === "sobreturno") color = "#dc3545";
            if (ev.extendedProps?.estado === "Completado") color = "#198754";
            if (ev.extendedProps?.estado === "Cancelado") color = "#6c757d";
            if (ev.extendedProps?.estado === "Disponible") color = "#198754";

            return {
              ...ev,
              display: 'block',
              backgroundColor: color,
              borderColor: color,
              textColor: "transparent"
            };
          });

          successCallback(mapa);
        })
        .catch(err => failureCallback(err));
    },

    eventClick: function (info) {
      const e = info.event;

      if (role === "paciente") {

        const start = e.start;
        if (!start) return;

        const pad = n => String(n).padStart(2, '0');
        const y = start.getFullYear();
        const m = pad(start.getMonth() + 1);
        const d = pad(start.getDate());
        const hh = pad(start.getHours());
        const mm = pad(start.getMinutes());
        const value = `${y}-${m}-${d}T${hh}:${mm}`;

        if (window.opener && !window.opener.closed) {
          const input = window.opener.document.getElementById('fechaHora');
          if (input) {
            input.value = value;
            window.close();
          }
        }

        return;
      }

      Swal.fire({
        title: e.title || "Turno",
        html: `
          <b>Fecha:</b> ${e.start.toLocaleString()}<br>
          <b>Paciente:</b> ${e.extendedProps.paciente || '—'}<br>
          <b>Motivo:</b> ${e.extendedProps.motivo || '—'}<br>
          <b>Tipo:</b> ${e.extendedProps.tipoTurno || 'regular'}<br>
          <b>Estado:</b> ${e.extendedProps.estado || '—'}
        `,
        icon: 'info'
      });
    },

    dayCellDidMount: function (arg) {
      const d = arg.date.getUTCDay();
      const fecha = arg.date.toISOString().slice(0, 10);
      const esFeriado = feriados.includes(fecha);

      if (!diasLaborales.includes(d) || esFeriado) {
        arg.el.style.backgroundColor = '#d5d5d5';
        arg.el.style.opacity = '0.6';
        arg.el.style.pointerEvents = 'none';
      }
    }
  });

  calendar.render();
});
