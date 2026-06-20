# Guía de Integración — Conectar Formularios al Agente

> Este archivo es para empleados y para Claude cuando ayude a conectar el formulario
> de un cliente a su Worker de Cloudflare.

---

## Cómo funciona

El agente expone un endpoint `POST /lead` que recibe los datos del formulario como JSON.
Solo hay que hacer un `fetch()` (o equivalente) desde el formulario existente del cliente
hacia la URL del Worker. No se toca nada más del sitio.

---

## Especificación del endpoint

```
POST https://agente-[slug].TU-SUBDOMINIO.workers.dev/lead
Content-Type: application/json
```

### Campos del payload

| Campo | Requerido | Descripción |
|---|---|---|
| `nombre` | ✅ Siempre | Nombre del cliente |
| `telefono` | ✅ Siempre | Teléfono de contacto |
| `problema` | ✅ Siempre | Descripción del servicio o consulta |
| `email` | Opcional | Correo del cliente |
| `direccion` | Opcional | Dirección o colonia |
| `disponibilidad` | Opcional | Horario preferido |
| `[cualquier_campo]` | Opcional | El Worker acepta campos extra — todos llegan en la alerta |

Los campos requeridos se configuran en `config/[cliente].json` → `formulario.camposRequeridos`.

### Respuesta exitosa (200)

```json
{
  "success": true,
  "mensaje": "¡Gracias! Nos pondremos en contacto en menos de 30 minutos.",
  "analisis": "Resumen: ... Cotización: ..."
}
```

El campo `analisis` solo aparece si el paquete tiene IA activada.

### Respuesta de error (422 — campos faltantes)

```json
{
  "success": false,
  "error": "El campo 'telefono' es requerido."
}
```

---

## Snippets de integración por tecnología

> 💡 **Tip para empleados:** Si tienes acceso al código del sitio en VS Code,
> abre la carpeta con Claude Code y dile: _"Integra el formulario de contacto con
> esta URL: https://agente-[slug].subdominio.workers.dev/lead"_.
> Claude leerá los archivos, encontrará el form y escribirá la integración exacta.

---

### JavaScript puro (HTML estático)

Agrega esto al `<script>` de la página donde está el formulario:

```html
<script>
document.getElementById('form-contacto').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const datos = {
    nombre:         document.getElementById('nombre').value,
    telefono:       document.getElementById('telefono').value,
    problema:       document.getElementById('problema').value,
    email:          document.getElementById('email')?.value || '',
    disponibilidad: document.getElementById('disponibilidad')?.value || ''
  };

  try {
    const res = await fetch('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    const json = await res.json();

    if (json.success) {
      document.getElementById('form-contacto').innerHTML =
        `<p style="color:green">✅ ${json.mensaje}</p>`;
    } else {
      alert('Error: ' + json.error);
      btn.disabled = false;
      btn.textContent = 'Enviar';
    }
  } catch (err) {
    alert('Error de conexión. Intenta de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
});
</script>
```

---

### WordPress — functions.php (sin plugins)

Agrega esto en `functions.php` del tema activo o en un plugin hijo:

```php
<?php
// Endpoint AJAX para enviar el formulario al agente
add_action('wp_ajax_enviar_lead', 'enviar_lead_agente');
add_action('wp_ajax_nopriv_enviar_lead', 'enviar_lead_agente');

function enviar_lead_agente() {
    check_ajax_referer('lead_nonce', 'nonce');

    $datos = [
        'nombre'        => sanitize_text_field($_POST['nombre'] ?? ''),
        'telefono'      => sanitize_text_field($_POST['telefono'] ?? ''),
        'problema'      => sanitize_textarea_field($_POST['problema'] ?? ''),
        'email'         => sanitize_email($_POST['email'] ?? ''),
        'disponibilidad'=> sanitize_text_field($_POST['disponibilidad'] ?? '')
    ];

    $response = wp_remote_post('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead', [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode($datos),
        'timeout' => 15
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['error' => 'Error de conexión con el agente.']);
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    wp_send_json($body);
}

// Pasar nonce al JS del formulario
add_action('wp_enqueue_scripts', function() {
    wp_localize_script('jquery', 'agenteConfig', [
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce'   => wp_create_nonce('lead_nonce')
    ]);
});
```

Y el JS del formulario en WordPress:

```javascript
jQuery('#form-contacto').on('submit', function(e) {
  e.preventDefault();
  jQuery.post(agenteConfig.ajaxurl, {
    action:         'enviar_lead',
    nonce:          agenteConfig.nonce,
    nombre:         jQuery('#nombre').val(),
    telefono:       jQuery('#telefono').val(),
    problema:       jQuery('#problema').val(),
    email:          jQuery('#email').val(),
    disponibilidad: jQuery('#disponibilidad').val()
  }, function(res) {
    if (res.success) {
      jQuery('#form-contacto').html('<p>✅ ' + res.mensaje + '</p>');
    } else {
      alert('Error: ' + res.error);
    }
  });
});
```

---

### WordPress — Contact Form 7

En el tab "Correo" del formulario en CF7, agrega este hook en `functions.php`:

```php
<?php
add_action('wpcf7_mail_sent', function($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;

    $data = $submission->get_posted_data();

    wp_remote_post('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead', [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode([
            'nombre'   => $data['your-name']    ?? '',
            'telefono' => $data['your-phone']   ?? '',
            'problema' => $data['your-message'] ?? '',
            'email'    => $data['your-email']   ?? ''
        ]),
        'timeout'  => 10,
        'blocking' => false   // No bloquea la confirmación de CF7
    ]);
});
```

> Los nombres de los campos (`your-name`, `your-phone`, etc.) deben coincidir
> con los `name` que tiene el formulario CF7. Revísalos en el editor del formulario.

---

### PHP puro

```php
<?php
// En el archivo que procesa el POST del formulario
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $datos = json_encode([
        'nombre'        => htmlspecialchars($_POST['nombre']   ?? ''),
        'telefono'      => htmlspecialchars($_POST['telefono'] ?? ''),
        'problema'      => htmlspecialchars($_POST['problema'] ?? ''),
        'email'         => filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL),
        'disponibilidad'=> htmlspecialchars($_POST['disponibilidad'] ?? '')
    ]);

    $ch = curl_init('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $datos,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 10
    ]);

    $response = curl_exec($ch);
    $result   = json_decode($response, true);
    curl_close($ch);

    if ($result['success'] ?? false) {
        echo '<p>✅ ' . htmlspecialchars($result['mensaje']) . '</p>';
    } else {
        echo '<p>Error: ' . htmlspecialchars($result['error'] ?? 'Intenta de nuevo') . '</p>';
    }
}
```

---

### React

```jsx
import { useState } from 'react';

const WORKER_URL = 'https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead';

export default function FormularioContacto() {
  const [form, setForm]     = useState({ nombre: '', telefono: '', problema: '', email: '' });
  const [estado, setEstado] = useState('idle'); // idle | loading | success | error
  const [mensaje, setMensaje] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEstado('loading');

    try {
      const res  = await fetch(WORKER_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form)
      });
      const json = await res.json();

      if (json.success) {
        setEstado('success');
        setMensaje(json.mensaje);
      } else {
        setEstado('error');
        setMensaje(json.error || 'Error desconocido');
      }
    } catch {
      setEstado('error');
      setMensaje('Error de conexión. Intenta de nuevo.');
    }
  };

  if (estado === 'success') return <p>✅ {mensaje}</p>;

  return (
    <form onSubmit={handleSubmit}>
      <input name="nombre"   placeholder="Tu nombre"   onChange={handleChange} required />
      <input name="telefono" placeholder="Tu teléfono" onChange={handleChange} required />
      <input name="email"    placeholder="Tu correo"   onChange={handleChange} type="email" />
      <textarea name="problema" placeholder="¿En qué te podemos ayudar?" onChange={handleChange} required />
      <button type="submit" disabled={estado === 'loading'}>
        {estado === 'loading' ? 'Enviando...' : 'Solicitar cotización'}
      </button>
      {estado === 'error' && <p style={{color:'red'}}>{mensaje}</p>}
    </form>
  );
}
```

---

### Laravel

En el controlador:

```php
<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ContactoController extends Controller
{
    public function enviar(Request $request)
    {
        $validated = $request->validate([
            'nombre'   => 'required|string|max:100',
            'telefono' => 'required|string|max:20',
            'problema' => 'required|string|max:1000',
            'email'    => 'nullable|email'
        ]);

        $response = Http::timeout(10)
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead', $validated);

        $result = $response->json();

        if ($result['success'] ?? false) {
            return back()->with('success', $result['mensaje']);
        }

        return back()->withErrors(['agente' => $result['error'] ?? 'Error al enviar.']);
    }
}
```

Ruta en `routes/web.php`:
```php
Route::post('/contacto', [ContactoController::class, 'enviar'])->name('contacto.enviar');
```

---

### Webflow (vía script personalizado)

En Webflow no se puede modificar el backend, pero sí interceptar el submit del formulario nativo.
Agrega esto en **Configuración del proyecto → Custom Code → Footer Code**:

```html
<script>
// Intercepta el formulario de Webflow y lo redirige al Worker
document.addEventListener('DOMContentLoaded', function() {
  var form = document.querySelector('[data-name="Formulario Contacto"]'); // Cambia el nombre
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();

    var datos = {
      nombre:   form.querySelector('[name="nombre"]')?.value   || '',
      telefono: form.querySelector('[name="telefono"]')?.value || '',
      problema: form.querySelector('[name="problema"]')?.value || '',
      email:    form.querySelector('[name="email"]')?.value    || ''
    };

    try {
      var res  = await fetch('https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      var json = await res.json();
      if (json.success) {
        // Mostrar el mensaje de éxito de Webflow manualmente
        var success = form.parentElement.querySelector('.w-form-done');
        if (success) success.style.display = 'block';
        form.style.display = 'none';
      }
    } catch(err) {
      console.error('Error enviando al agente:', err);
    }
  });
});
</script>
```

---

## Verificar que la integración funciona

Después de conectar el formulario, prueba con el health check:

```
GET https://agente-[slug].TU-SUBDOMINIO.workers.dev/health
→ { "status": "ok", "worker": "NombreCliente", "timestamp": "..." }
```

Y envía un lead de prueba manual desde la terminal:

```bash
curl -X POST https://agente-[SLUG].TU-SUBDOMINIO.workers.dev/lead \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","telefono":"0000000000","problema":"Prueba de integración"}'
```

Deberías recibir la alerta en Telegram en menos de 3 segundos.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Error 403 | El dominio del cliente no está en `ALLOWED_ORIGINS` | Agregar el dominio en `config/[cliente].json` → `cors.origenesPermitidos` y redesplegar |
| Error 422 | Falta un campo requerido | Verificar que el form envía todos los campos de `formulario.camposRequeridos` |
| Error 502 | Falla en Telegram o Resend | Revisar que los secrets están cargados: `wrangler secret list --name agente-[slug]` |
| Sin alerta en Telegram | `TELEGRAM_CHAT_ID` incorrecto | Verificar el ID con @userinfobot en el grupo |
| Origen bloqueado en local | `localhost` no está en `ALLOWED_ORIGINS` | Para pruebas locales, agregar `http://localhost:5500` al config |
