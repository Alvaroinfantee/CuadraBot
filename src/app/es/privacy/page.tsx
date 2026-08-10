import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/privacy",
  title: "Política de privacidad",
  description:
    "Cómo recopila, utiliza, protege y conserva Cuadrabot los datos de cuentas, facturación y proyectos.",
})

export default function PrivacyPageEs() {
  return (
    <PolicyPage
      title="Política de privacidad"
      effective="9 de agosto de 2026"
    >
      <PolicySection title="1. Quién es responsable">
        <p>
          Cuadrabot es el responsable del tratamiento de la información de la
          cuenta, facturación, uso del producto y soporte utilizada para operar
          este servicio. El operador legal y la identidad fiscal se muestran en
          la pantalla de Checkout y en tu factura. Puedes escribirnos a{" "}
          <a href="mailto:privacy@cuadrabot.com">privacy@cuadrabot.com</a>.
        </p>
      </PolicySection>
      <PolicySection title="2. Información que tratamos">
        <ul>
          <li>
            Datos de la cuenta, como nombre, correo profesional, empresa y
            registros de autenticación.
          </li>
          <li>
            Ubicación empresarial aproximada, como país, región y ciudad,
            obtenida de tu perfil o de los datos de facturación.
          </li>
          <li>
            Materiales privados de proyectos, incluidos los PDF de planos, las
            notas de alcance, las cantidades generadas, los planos marcados, los
            libros y los registros de validación.
          </li>
          <li>
            Referencias de facturación, estado de la suscripción, créditos
            comprados y consumidos, facturas, reembolsos y disputas. Stripe
            almacena los datos completos de las tarjetas; Cuadrabot no.
          </li>
          <li>
            Eventos operativos, como cargas, etapas de trabajos, descargas,
            solicitudes de soporte, estado del servicio, registros de auditoría
            y registros de seguridad.
          </li>
        </ul>
      </PolicySection>
      <PolicySection title="3. Para qué la tratamos">
        <p>
          Tratamos los datos para crear y proteger cuentas; verificar, medir y
          validar conjuntos de planos; entregar archivos; cobrar pagos;
          gestionar créditos y suscripciones; prestar soporte; prevenir abusos;
          supervisar la fiabilidad; mejorar el producto mediante evidencias
          operativas agregadas; y cumplir obligaciones legales, fiscales,
          contables y de seguridad.
        </p>
        <p>
          Según el contexto, nuestras bases jurídicas incluyen la ejecución del
          contrato del servicio, el interés legítimo en operar y proteger el
          servicio, las obligaciones legales y el consentimiento cuando sea
          necesario.
        </p>
      </PolicySection>
      <PolicySection title="4. Uso de modelos y encargados del tratamiento">
        <p>
          Los materiales del proyecto pueden enviarse a proveedores contratados
          de infraestructura y procesamiento únicamente para prestar el servicio
          de medición. Cuadrabot no utiliza los planos de sus clientes para
          entrenar sus propios modelos sin un consentimiento independiente y
          explícito. El tratamiento de los proveedores está sujeto a las
          condiciones empresariales y a los compromisos de tratamiento de datos
          pertinentes.
        </p>
      </PolicySection>
      <PolicySection title="5. Cesiones y transferencias internacionales">
        <p>
          Utilizamos proveedores para alojamiento, base de datos y
          almacenamiento de objetos, procesamiento de pagos, correo,
          monitorización y análisis automatizado. Solo comunicamos lo que cada
          proveedor necesita para su función. Cuando los datos se transfieren
          fuera del EEE, utilizamos un mecanismo legal disponible, como una
          decisión de adecuación o garantías contractuales aprobadas.
        </p>
      </PolicySection>
      <PolicySection title="6. Conservación">
        <p>
          Los registros de cuenta y facturación se conservan mientras la cuenta
          esté activa y durante el tiempo exigido por obligaciones fiscales,
          contables, legales o relativas a disputas. Cuando un plano cargado
          supera la verificación, su PDF original se conserva en un archivo
          privado de fuentes mientras la cuenta esté activa, para el historial
          del proyecto, la recuperación, el soporte y la gestión de disputas. El
          registro del archivo conserva la propiedad, el tamaño, el número de
          páginas y una huella SHA-256. Los clientes pueden descargar su plano
          original desde el espacio de trabajo del proyecto y solicitar su
          eliminación, sujeta a verificación de identidad y a cualquier
          retención legal aplicable.
        </p>
        <p>
          Las cargas no verificadas o abandonadas se eliminan después de 24
          horas. Las copias de trabajo del procesador y los entregables
          generados se eliminan mediante un proceso programado una vez
          transcurrido el periodo de conservación del trabajo finalizado; el
          periodo vigente puede solicitarse a soporte. Las copias de
          recuperación del proveedor, cuando estén activadas, siguen un ciclo de
          vida independiente, restringido y finito. El historial de trabajos,
          facturación, créditos, seguridad y auditoría puede conservarse o
          anonimizarse para los fines indicados. Una retención legal u otra
          obligación puede exigir una conservación más prolongada.
        </p>
      </PolicySection>
      <PolicySection title="7. Cookies y medición de marketing">
        <p>
          Cuadrabot utiliza cookies y almacenamiento similares necesarios para
          el inicio de sesión, la seguridad, el idioma y las funciones
          esenciales del servicio. Con tu permiso, también registramos eventos
          propios de marketing y utilizamos la etiqueta de Google y la medición
          de conversiones de Google Ads. Los eventos propios pueden incluir el
          país o región aproximados, la categoría del dispositivo, la familia
          del navegador y del sistema operativo, el dominio de referencia,
          etiquetas de campaña, identificadores publicitarios de clic, páginas
          vistas, cuentas creadas correctamente, inicios de carga de planos,
          inicios de pago y compras verificadas. No conservamos direcciones IP sin
          procesar ni cadenas completas de agente de usuario en este registro.
        </p>
        <p>
          El consentimiento para almacenamiento publicitario, analítica, datos
          de usuario publicitarios, personalización y analítica de marketing de
          Cuadrabot se deniega por defecto en todas las regiones, incluidos el
          EEE, Reino Unido y Suiza, hasta que lo permitas expresamente. Si lo
          rechazas, no se guarda ningún evento en nuestra base de marketing; las
          etiquetas de Google pueden enviar señales sin cookies adaptadas al
          consentimiento y con censura de datos publicitarios. Puedes rechazar,
          permitir o retirar esta opción mediante Configurar cookies. Global
          Privacy Control se trata como una denegación. Los eventos consentidos
          se eliminan de forma programada después de 13 meses. Consulta la{" "}
          <a href="https://policies.google.com/privacy">política de privacidad de Google</a>{" "}
          para conocer su tratamiento y sus garantías para transferencias
          internacionales.
        </p>
        <p>
          El titular de una cuenta puede compartir voluntariamente un rango de
          edad desde los datos de la empresa para análisis agregados. Nunca
          inferimos la edad; el campo es opcional y retirar el consentimiento
          elimina el valor del perfil. Los eventos de compra incluyen la
          referencia de la transacción, la moneda y el importe confirmado por
          Stripe, pero no los datos completos de la tarjeta.
        </p>
      </PolicySection>
      <PolicySection title="8. Tus opciones y derechos">
        <p>
          Dependiendo de tu ubicación, puedes solicitar acceso, rectificación,
          supresión, limitación, portabilidad u oposición, y retirar el
          consentimiento cuando el tratamiento dependa de él. También puedes
          reclamar ante tu autoridad local de protección de datos. Escribe a{" "}
          <a href="mailto:privacy@cuadrabot.com">privacy@cuadrabot.com</a>.
          Podemos verificar tu identidad antes de atender una solicitud.
        </p>
      </PolicySection>
      <PolicySection title="9. Seguridad y cambios">
        <p>
          Utilizamos almacenamiento privado, reglas de acceso por cliente,
          enlaces firmados de corta duración, credenciales solo en el servidor,
          registros de fuentes respaldados por checksum, comprobaciones
          programadas de presencia de objetos, registros de auditoría y acceso
          administrativo restringido. Ningún sistema es completamente seguro.
          Actualizaremos esta política cuando el tratamiento cambie de forma
          sustancial y publicaremos la nueva fecha de entrada en vigor.
        </p>
      </PolicySection>
    </PolicyPage>
  )
}

function PolicyPage({
  title,
  effective,
  children,
}: {
  title: string
  effective: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              En vigor desde el {effective}
            </p>
          </div>
        </section>
        <article className="policy-copy mx-auto max-w-4xl px-4 py-16 sm:px-6">
          {children}
        </article>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  )
}
