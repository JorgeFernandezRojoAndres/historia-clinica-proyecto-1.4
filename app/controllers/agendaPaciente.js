document.addEventListener("DOMContentLoaded", () => {
    const medicoId = document.body.dataset.medicoId;

    const dateInput = document.getElementById("seleccionar-dia");
    if (!dateInput) return;

    dateInput.addEventListener("change", () => {
        const fecha = dateInput.value; // YYYY-MM-DD

        fetch(`/medicos/${medicoId}/citas-json?start=${fecha}T00:00:00Z&end=${fecha}T23:59:59Z&role=paciente`)
            .then(r => r.json())
            .then(citas => {
                const libres = citas
                    .filter(c => c.extendedProps?.estado === "Disponible")
                    .map(ev => {
                        const f = new Date(ev.start);
                        const hh = String(f.getUTCHours()).padStart(2, "0");
                        const mm = String(f.getUTCMinutes()).padStart(2, "0");
                        return `${hh}:${mm}`;
                    });

                if (libres.length === 0) {
                    Swal.fire("Sin horarios", "Este día no tiene ningún horario libre.", "warning");
                    return;
                }

                const optionsHtml = libres
                    .map(h => `<option value="${h}">${h}</option>`)
                    .join("");

                Swal.fire({
                    title: "Elegí un horario",
                    html: `
                        <select id="swal-horario" class="swal2-input">
                            ${optionsHtml}
                        </select>
                    `,
                    confirmButtonText: "Aceptar",
                    showCancelButton: true,
                    preConfirm: () => document.getElementById("swal-horario").value
                }).then(result => {
                    if (!result.isConfirmed) return;

                    const hora = result.value;
                    const value = `${fecha}T${hora}`;

                    if (window.opener && !window.opener.closed) {
                        const input = window.opener.document.getElementById('fechaHora');
                        input.value = value;
                        window.close();
                    }
                });
            });
    });
});
