#!/usr/bin/env python3
"""Genera el Documento Técnico de Modelo de Utilidad según Anexo 2."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, Inches, RGBColor
from docx.enum.section import WD_ORIENT

ROOT = Path(__file__).resolve().parent
FIG = ROOT / "figuras"
OUT = ROOT / "Documento_Tecnico_Modelo_de_Utilidad.docx"

TITULO = "MÁQUINA RECICLADORA DE ENVASES CON RECONOCIMIENTO VISUAL"


def set_run_font(run, name="Arial", size=11, bold=False, italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(0, 0, 0)


def add_line_numbering(section):
    sect_pr = section._sectPr
    ln = OxmlElement("w:lnNumType")
    ln.set(qn("w:countBy"), "5")
    ln.set(qn("w:restart"), "newPage")
    ln.set(qn("w:distance"), "567")
    sect_pr.append(ln)


def setup_section(section, landscape=False):
    section.page_width = Cm(29.7) if landscape else Cm(21.0)
    section.page_height = Cm(21.0) if landscape else Cm(29.7)
    section.orientation = WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(2.5)
    section.header_distance = Cm(1.2)
    section.footer_distance = Cm(1.2)
    add_line_numbering(section)

    footer = section.footer
    footer.is_linked_to_previous = False
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Página ")
    set_run_font(run, size=9)
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run2 = p.add_run()
    run2._r.append(fld1)
    run2._r.append(instr)
    run2._r.append(fld2)
    set_run_font(run2, size=9)


def heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16 if level == 1 else 12)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, size=13 if level == 1 else 12, bold=True)
    return p


def body(doc, text, first_line=True, space_after=8):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    if first_line:
        p.paragraph_format.first_line_indent = Cm(1.0)
    run = p.add_run(text)
    set_run_font(run, size=11)
    return p


def nbody(doc, n, text):
    return body(doc, f"[{n:04d}]  {text}", first_line=False)


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    p.paragraph_format.left_indent = Cm(1.25)
    p.paragraph_format.space_after = Pt(4)
    if p.runs:
        p.runs[0].text = text
        set_run_font(p.runs[0], size=11)
    else:
        run = p.add_run(text)
        set_run_font(run, size=11)
    return p


def claim(doc, number, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(12)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.75)
    run_n = p.add_run(f"{number}.\t")
    set_run_font(run_n, size=11, bold=True)
    run = p.add_run(text)
    set_run_font(run, size=11)
    return p


def page_break(doc):
    doc.add_page_break()


def add_figure(doc, filename, caption):
    page_break(doc)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(10)
    run = p.add_run()
    path = FIG / filename
    run.add_picture(str(path), width=Cm(15.5))
    # El rótulo FIG. N ya está en el propio dibujo, como exige la práctica de patentes.


def build():
    doc = Document()
    setup_section(doc.sections[0])

    style = doc.styles["Normal"]
    style.font.name = "Arial"
    style.font.size = Pt(11)

    # Portada interna (no sustituye el formulario oficial)
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t.paragraph_format.space_before = Pt(24)
    r = t.add_run("ANEXO 2")
    set_run_font(r, size=12, bold=True)

    t2 = doc.add_paragraph()
    t2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t2.add_run("FORMATO DE DOCUMENTO TÉCNICO DE INVENCIÓN O MODELO DE UTILIDAD")
    set_run_font(r, size=12, bold=True)

    t3 = doc.add_paragraph()
    t3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t3.paragraph_format.space_before = Pt(8)
    r = t3.add_run("Solicitud de registro de modelo de utilidad")
    set_run_font(r, size=11, italic=True)

    # I
    heading(doc, "I. TÍTULO")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(12)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r = p.add_run(TITULO)
    set_run_font(r, size=12, bold=True)

    # II
    heading(doc, "II. SECTOR TECNOLÓGICO")
    nbody(
        doc,
        1,
        "La presente invención se relaciona con el sector de las máquinas automáticas de recepción, "
        "reconocimiento y clasificación de botellas tipo PET desechables y latas de aluminio, utilizando "
        "clasificación óptica; además, se relaciona con un sistema de incentivos.",
    )

    # III
    heading(doc, "III. ESTADO DE LA TÉCNICA ANTERIOR")
    nbody(
        doc,
        2,
        "Es conocido el empleo de contenedores pasivos de residuales, diferenciados por color o "
        "leyenda, para la recolección de botellas y latas. Dichos contenedores no verifican el tipo de "
        "envase, no identifican al usuario y no entregan contraprestación alguna. El resultado típico es "
        "una alta tasa de contaminación del flujo reciclable y una baja participación ciudadana, porque "
        "el acto de reciclar no produce una retroalimentación inmediata ni un registro auditable.",
    )
    nbody(
        doc,
        3,
        "En el extremo opuesto se encuentran las máquinas industriales de devolución inversa, "
        "comercializadas por fabricantes como Tomra, Envipco o Recyclever, concebidas para esquemas "
        "nacionales de depósito y reembolso (DRS). Un ejemplo representativo es la patente estadounidense "
        "US 8,851,265 B2, que describe una máquina de devolución inversa con tolva de ingreso, compactador, "
        "clasificación de envases metálicos y no metálicos, lector de código de barras, lector de "
        "identificación de usuario por banda magnética, tarjeta inteligente o RFID, pantalla, impresora "
        "de cupones y almacenamiento de transacciones en un computador local. Estas máquinas resuelven "
        "el problema del reembolso masivo en supermercados, pero presentan una configuración voluminosa, "
        "costosa y dependiente de infraestructura comercial (impresoras de vales, bases de códigos de "
        "barras homologadas, compactadores de alta potencia).",
    )
    nbody(
        doc,
        4,
        "Las máquinas industriales recientes incorporan, además, escaneo de código de barras en 360°, "
        "verificación de peso, detección de PET y aluminio, control antifraude por retracción del envase "
        "y, en algunos modelos, integración con aplicaciones mediante NFC o un código mostrado en "
        "pantalla al final de la sesión. En todos esos casos la identificación del material se apoya "
        "principalmente en el código de barras del producto y en sensores de material o peso, y la "
        "recompensa se entrega como cupón impreso, recarga de tarjeta de fidelización o transferencia "
        "a un esquema de depósito legal. No se divulga una arquitectura de dos procesadores embebidos "
        "de bajo costo en la que un módulo de visión ejecute la clasificación a bordo y un segundo "
        "módulo controle la sesión de usuario, el accionamiento y la acreditación remota.",
    )
    nbody(
        doc,
        5,
        "También son conocidos prototipos académicos y de electrónica de aficionado que emplean un "
        "microcontrolador, sensores infrarrojos o finales de carrera y, en algunos casos, una balanza, "
        "para detectar la caída de un objeto en un contenedor y enviar un conteo a una hoja de cálculo "
        "o a un servidor. Estos dispositivos no distinguen de manera fiable una botella de una lata, "
        "no evitan el doble conteo de un mismo objeto y no vinculan el evento a una identidad de usuario "
        "con exclusión mutua entre máquinas.",
    )
    nbody(
        doc,
        6,
        "Se han propuesto, asimismo, soluciones que envían la imagen del envase a un servidor en la "
        "nube para que un modelo de visión artificial la clasifique. Dicha disposición introduce "
        "latencia, dependencia permanente de un enlace de datos de alta capacidad y un costo operativo "
        "por inferencia. Además, concentra en un único tablero las funciones de cámara y de control "
        "electromecánico, lo que en plataformas del tipo ESP32-CAM genera conflictos de pines, de "
        "memoria PSRAM y de temporización entre la captura de imagen y el accionamiento de servomotores, "
        "teclados o buses I2C.",
    )
    nbody(
        doc,
        7,
        "Respecto de la identificación del usuario, el estado de la técnica oscila entre tarjetas RFID "
        "o magnéticas, que exigen un medio físico adicional, y el ingreso de un identificador en una "
        "pantalla táctil costosa. No se ha encontrado, en el conocimiento del solicitante, un aparato "
        "de recolección de envases que combine: (i) un código bidimensional fijo impreso sobre la "
        "máquina, escaneado desde el teléfono del usuario para armar una sesión temporal exclusiva; "
        "(ii) un teclado matricial de respaldo asociado a un número de cuenta de longitud fija; "
        "(iii) un clasificador visual embarcado con confirmación por tramas consecutivas y ventana "
        "de enfriamiento; y (iv) una acreditación remota de puntos que valida simultáneamente la "
        "sesión, el código de máquina y el tipo de envase.",
    )
    nbody(
        doc,
        8,
        "El problema técnico que la invención se propone resolver es, por tanto, disponer una máquina "
        "recicladora de envases de configuración compacta y de bajo costo relativo, capaz de: reconocer "
        "localmente si el objeto depositado es una botella o una lata sin enviar la imagen a un servidor; "
        "vincular de manera segura el depósito a un usuario concreto, incluso si este no porta una "
        "tarjeta física; evitar que dos usuarios o dos máquinas compartan una misma sesión activa; "
        "clasificar el envase hacia recipientes distintos; y acreditar de inmediato un incentivo "
        "consultable en un terminal móvil, con registro histórico y, de manera opcional, con un "
        "mecanismo de competencia territorial que refuerce la participación.",
    )

    # IV
    heading(doc, "IV. BREVE DESCRIPCIÓN DE LAS FIGURAS")
    nbody(
        doc,
        9,
        "Las figuras se presentan para facilitar la comprensión de la invención y no limitan su alcance. "
        "Las referencias numéricas se emplean de manera uniforme en la descripción y en las figuras.",
    )
    body(doc, "FIG. 1. Vista esquemática general del sistema.", first_line=False)
    body(doc, "FIG. 2. Vista frontal esquemática de la máquina recicladora de envases (1).", first_line=False)
    body(doc, "FIG. 3. Diagrama de bloques del hardware.", first_line=False)
    body(doc, "FIG. 4. Diagrama de flujo operativo de la máquina.", first_line=False)
    body(doc, "FIG. 5. Esquema del protocolo de comunicación serie entre módulos.", first_line=False)
    body(doc, "FIG. 6. Arquitectura de la plataforma remota y de la aplicación.", first_line=False)
    body(doc, "FIG. 7. Secuencia de armado de la sesión y de exclusión mutua.", first_line=False)

    heading(doc, "Descripción detallada de las figuras", level=2)
    nbody(
        doc,
        10,
        "Con relación a la Figura 1 se visualiza una vista esquemática general del sistema, que muestra "
        "el terminal móvil (14), la máquina recicladora de envases (1) y la plataforma remota de datos "
        "(15), y los flujos de código bidimensional, comunicación inalámbrica y acreditación de puntos. "
        "El sistema comprende tres bloques cooperantes. El primero es la máquina recicladora de envases "
        "(1), destinada a instalarse en un punto de recolección. El segundo es el terminal móvil (14) "
        "del usuario, que ejecuta una aplicación de autenticación, escaneo del código bidimensional (13), "
        "visualización de saldo, historial, catálogo de recompensas (28) y ranking territorial (29). "
        "El tercero es la plataforma remota de datos (15), que aloja la base de datos, las funciones de "
        "armado (21), sondeo (22), validación de cuenta (23) y acreditación de puntos (24), y un canal "
        "de publicación en tiempo real de los cambios de perfil y de sesión.",
    )
    nbody(
        doc,
        11,
        "Con relación a la Figura 2 se visualiza una vista frontal esquemática de la máquina recicladora "
        "de envases (1). La máquina (1) comprende una carcasa o gabinete que aloja y protege los módulos "
        "electrónicos y define una boca o conducto de ingreso (2) por la que el usuario introduce el "
        "envase (19). En la zona de la boca (2) se dispone la cámara de captura (4) del módulo de visión "
        "(3), orientada de modo que el envase quede dentro del campo visual. Debajo o a un lado de la "
        "boca se ubican la pantalla de cristal líquido (8), el teclado matricial (7), el código "
        "bidimensional (13) y el indicador asociado al relé (10). En la parte inferior, un servomotor "
        "(9) desvía el envase hacia el compartimento de botellas (11) o el compartimento de latas (12).",
    )
    nbody(
        doc,
        12,
        "Con relación a la Figura 3 se visualiza el diagrama de bloques del hardware. La arquitectura "
        "interna es deliberadamente bipartita: un módulo de visión artificial (3) con cámara (4) y "
        "unidad de inferencia visual embarcada (20), separado de un módulo controlador (5) provisto de "
        "comunicación inalámbrica (16). Ambos módulos se unen por un enlace de comunicación serie UART "
        "(6) y comparten tierra común (18). Del módulo controlador (5) penden el teclado (7), la "
        "pantalla (8), el actuador o servomotor (9) y el relé (10). La plataforma remota (15) se "
        "comunica con el módulo controlador (5) a través del módulo inalámbrico (16). La alimentación "
        "se provee por la fuente (17).",
    )
    nbody(
        doc,
        13,
        "Con relación a la Figura 4 se visualiza el diagrama de flujo operativo de la máquina. El "
        "ciclo comprende la espera de identificación del usuario, la verificación de sesión armada o "
        "cuenta válida, la activación del relé (10), la captura e inferencia visual en el módulo (3) "
        "y la unidad (20), la aceptación de la clase, el accionamiento del servomotor (9) hacia los "
        "compartimentos (11) o (12), la acreditación en la plataforma (15) y la actualización en "
        "tiempo real del terminal (14).",
    )
    nbody(
        doc,
        14,
        "Con relación a la Figura 5 se visualiza el esquema del protocolo de comunicación serie entre "
        "el módulo de visión (3), que emite por su puerto de transmisión los mensajes DETECT:bottle o "
        "DETECT:can, y el módulo controlador (5), que los recibe por su puerto de recepción. El enlace "
        "(6) opera a 115200 baudios, 8 bits, sin paridad y un bit de paro. El módulo controlador (5) "
        "ignora el mensaje si no existe contexto de usuario activo o si un envase anterior sigue en "
        "proceso.",
    )
    nbody(
        doc,
        15,
        "Con relación a la Figura 6 se visualiza la arquitectura de la plataforma remota (15) y de la "
        "aplicación del terminal (14). La plataforma expone las funciones de armado de sesión (21), "
        "sondeo de sesión (22), validación de cuenta (23) y acreditación de puntos (24), y almacena "
        "perfiles de usuario (25), máquinas, sesiones de reciclaje (27) y transacciones. El terminal "
        "(14) permite autenticar al usuario, leer el código bidimensional (13) o emplear el número de "
        "cuenta (26), observar el saldo y canjear recompensas (28).",
    )
    nbody(
        doc,
        16,
        "Con relación a la Figura 7 se visualiza la secuencia de armado de la sesión (27) y la "
        "exclusión mutua entre usuarios y entre máquinas. El usuario escanea el código (13) desde el "
        "terminal (14); la función (21) crea la sesión (27) con tiempo de vida inicial de sesenta "
        "segundos; el módulo controlador (5) la adopta mediante el sondeo (22). Si otro usuario arma "
        "sesión en la misma máquina, o si el mismo usuario arma sesión en otra máquina, la sesión "
        "previa se cancela.",
    )

    heading(doc, "Lista de signos de referencia", level=2)
    refs = [
        "(1) Máquina recicladora de envases",
        "(2) Boca o conducto de ingreso de envases",
        "(3) Módulo de visión artificial",
        "(4) Cámara de captura de imagen",
        "(5) Módulo controlador",
        "(6) Enlace de comunicación serie UART",
        "(7) Teclado matricial",
        "(8) Pantalla de cristal líquido",
        "(9) Actuador de clasificación (servomotor)",
        "(10) Relé de señalización de estado",
        "(11) Compartimento de botellas",
        "(12) Compartimento de latas",
        "(13) Código bidimensional de identificación de la máquina",
        "(14) Terminal móvil del usuario",
        "(15) Plataforma remota de datos",
        "(16) Módulo de comunicación inalámbrica",
        "(17) Fuente de alimentación",
        "(18) Conexión de tierra común",
        "(19) Envase a reciclar",
        "(20) Unidad de inferencia visual embarcada",
        "(21) Función remota de armado de sesión",
        "(22) Función remota de sondeo de sesión",
        "(23) Función remota de validación de cuenta",
        "(24) Función remota de acreditación de puntos",
        "(25) Perfil de usuario",
        "(26) Número de cuenta de seis dígitos",
        "(27) Sesión de reciclaje armada",
        "(28) Catálogo de recompensas",
        "(29) Módulo de ranking territorial",
    ]
    for item in refs:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.left_indent = Cm(1.0)
        r = p.add_run(item)
        set_run_font(r, size=11)

    # V
    heading(doc, "V. DESCRIPCIÓN DETALLADA DE LA INVENCIÓN")
    heading(doc, "V.1 Objeto, clasificación y ventajas técnicas", level=2)
    nbody(
        doc,
        17,
        "El objeto de la presente invención es una máquina recicladora de envases (1) y, en una "
        "reivindicación independiente de sistema, el conjunto formado por dicha máquina, un terminal "
        "móvil (14) y una plataforma remota de datos (15). La máquina recicladora de envases (1) "
        "presenta una nueva disposición de elementos electrónicos, electromecánicos y de identificación "
        "que permite un funcionamiento distinto y ventajoso respecto de las máquinas de devolución "
        "inversa industriales y de los prototipos basados en sensores binarios.",
    )
    nbody(
        doc,
        18,
        "De acuerdo con la Clasificación Internacional de Patentes, el objeto reivindicado se encuadra "
        "principalmente en G07F 7/06 (aparatos accionados por objetos distintos de monedas, en particular "
        "por envases retornables), B07C 5/342 (separación según propiedades ópticas de los objetos), "
        "G06V 20/00 (reconocimiento de escenas; reconocimiento de objetos en imagen) y, de manera "
        "accesoria, G06Q 30/0207 (sistemas de incentivos o recompensas vinculados a una transacción).",
    )
    nbody(
        doc,
        19,
        "El campo de aplicación inmediato es el de los equipos de recolección selectiva de residuales "
        "instalados en campus universitarios, centros educativos, municipalidades, edificios públicos, "
        "centros comerciales de escala media y comunidades, donde se requiere un aparato de costo "
        "contenido, operación autónoma y acreditación inmediata de un incentivo al usuario que deposita "
        "el envase.",
    )
    nbody(
        doc,
        20,
        "Las ventajas técnicas que se obtienen, sin que ellas limiten el alcance de la presente "
        "invención, son las siguientes. Primera: la clasificación del envase (19) se realiza a bordo, "
        "en una unidad de inferencia visual (20) alojada en un módulo de visión (3) separado del módulo "
        "controlador (5), con lo que se elimina la latencia y el costo de una inferencia en la nube y se "
        "evitan los conflictos de recursos de un tablero único. Segunda: un protocolo serie UART (6) de "
        "mensajes cortos DETECT:bottle y DETECT:can desacopla la percepción del control, de modo que el "
        "módulo (3) no necesita pila TCP/IP ni credenciales de red. Tercera: la confirmación por un "
        "número predeterminado de inferencias consecutivas y una ventana de enfriamiento impide acreditar "
        "dos veces el mismo envase. Cuarta: la identificación del usuario es dual (código bidimensional "
        "(13) escaneado desde el terminal (14), o número de cuenta (26) digitado en el teclado (7)), lo "
        "que permite operar con o sin cámara del teléfono. Quinta: la sesión de reciclaje (27) es "
        "exclusiva por usuario y por máquina, con un tiempo de vida inicial de sesenta segundos renovable "
        "al aceptarse un envase, lo que reduce la usurpación de puntos y la ocupación indefinida del "
        "aparato. Sexta: el accionamiento de un servomotor (9) dirige el envase a un compartimento de "
        "botellas (11) o de latas (12), produciendo un flujo materialmente separado. Séptima: un relé "
        "(10) señaliza el estado armado y una pantalla LCD (8) informa al usuario sin requerir una "
        "pantalla táctil industrial. Octava: la acreditación remota (24) actualiza el saldo del perfil "
        "(25) y el recuento de la sesión, de manera que el terminal (14) refleja el evento en tiempo real.",
    )

    heading(doc, "V.2 Identificación de la máquina", level=2)
    nbody(
        doc,
        21,
        "La máquina recicladora de envases (1) se identifica de manera unívoca mediante un código de "
        "máquina de formato prefijo-alfanumérico, en la realización preferente ECO- seguido de seis "
        "caracteres alfanuméricos en mayúsculas. Dicho código se imprime como código bidimensional (13) "
        "con la carga útil ecorewards://machine/<código> y se graba en el firmware del módulo "
        "controlador (5). La plataforma (15) mantiene un registro de máquinas activas, de modo que un "
        "código desconocido o inactivo no puede armar sesión.",
    )

    heading(doc, "V.3 Disposición interna y cableado", level=2)
    nbody(
        doc,
        22,
        "En la realización preferente, el módulo "
        "de visión (3) se realiza preferentemente sobre una placa ESP32-CAM de modelo AI Thinker, con "
        "cámara OV2640 (4), memoria PSRAM y una unidad de inferencia (20) obtenida de un modelo de "
        "aprendizaje automático compilado para el microcontrolador (en la realización preferente, un "
        "impulso de clasificación o detección de objetos exportado para Arduino). El módulo (3) no "
        "se conecta a la red de área local: su única salida de aplicación es el puerto serie (6).",
    )
    nbody(
        doc,
        23,
        "El módulo controlador (5) se realiza sobre una placa ESP32 con pila WiFi (16). Recibe por el "
        "pin GPIO32, configurado como RX de un UART a 115200 baudios, 8 bits, sin paridad y un bit de "
        "paro, los mensajes emitidos por el pin GPIO14 TX del módulo (3). Ambos módulos comparten una "
        "conexión de tierra común (18). La alimentación (17) provee 5 V al relé (10), al servomotor (9) "
        "y, según el backpack empleado, a la pantalla (8); los pines GPIO del ESP32 no se conectan "
        "directamente a 5 V. En una realización, la pantalla (8) se cablea a GPIO21 (SDA) y GPIO22 (SCL), "
        "y la bobina de entrada del relé (10) a GPIO23, con la posibilidad de invertir la lógica mediante "
        "una constante RELAY_ACTIVE_HIGH si el módulo de relé es de lógica negativa.",
    )
    nbody(
        doc,
        24,
        "El teclado (7) se cablea, en la realización ejemplificada, con filas en los pines 19, 18, 17 y "
        "16 y columnas en los pines 27, 26, 25 y 33. Las teclas numéricas concatenan un número de cuenta "
        "(26) de exactamente seis dígitos; la tecla numeral confirma y dispara la validación remota (23); "
        "la tecla asterisco borra la entrada y cancela la cuenta activa. El relé (10) se energiza cuando "
        "existe una sesión QR armada o cuando ha comenzado la digitación de una cuenta, y se desenergiza "
        "al completar, expirar, cancelar o rechazar la operación, de modo que un observador o un circuito "
        "auxiliar puede conocer el estado de ocupación de la máquina.",
    )

    heading(doc, "V.4 Reconocimiento visual embarcado", level=2)
    nbody(
        doc,
        25,
        "El módulo (3) inicializa el sensor de imagen, reserva un búfer RGB888 de 320×240×3 bytes y, "
        "en bucle, captura un fotograma JPEG, lo convierte a RGB, lo redimensiona si el modelo lo exige "
        "y ejecuta el clasificador. De las etiquetas producidas se retienen únicamente las clases "
        "rastreables bottle y can, normalizando variantes en español o con distinta capitalización "
        "(botella, lata, Bottle, Can). Se descarta toda detección cuya confianza sea inferior a 0,75.",
    )
    nbody(
        doc,
        26,
        "Para aceptar un envase se exige que la misma etiqueta rastreable aparezca en tres inferencias "
        "consecutivas y que haya transcurrido una ventana de enfriamiento de 4000 ms desde la última "
        "aceptación. Si la etiqueta se pierde, el contador consecutivo se reinicia. Cumplidas ambas "
        "condiciones, el módulo (3) emite por el UART (6) una línea ASCII terminada en salto de línea "
        "con el formato DETECT:bottle o DETECT:can, según la FIG. 5. La confianza no viaja en el "
        "mensaje de la versión preferente, aunque el protocolo admite la extensión DETECT:<clase>:<confianza> "
        "sin romper el prefijo. Con ello se obtiene un reconocimiento robusto frente a destellos, manos "
        "del usuario y pases parciales del envase por el campo visual, sin compactador ni lector de "
        "código de barras.",
    )

    heading(doc, "V.5 Control de sesión, clasificación y acreditación", level=2)
    nbody(
        doc,
        27,
        "El módulo controlador (5) ignora todo mensaje que no comience por DETECT: y también ignora "
        "detecciones válidas si no hay sesión QR ni cuenta de teclado activa, o si un envase anterior "
        "sigue en proceso. Tras aceptar una detección, ejecuta un ciclo del servomotor (9) hacia el "
        "compartimento (11) si la clase es bottle, o hacia el compartimento (12) si la clase es can, "
        "y a continuación invoca la función remota de acreditación (24) incluyendo el identificador de "
        "sesión y el código de máquina, o, en el flujo de teclado, el número de cuenta (26). La cuenta "
        "activa de teclado se limpia solo si la acreditación responde con éxito; la sesión QR permanece "
        "en la plataforma (15) hasta que expira o es reemplazada.",
    )
    nbody(
        doc,
        28,
        "La pantalla (8) muestra mensajes cortos que guían la operación: invitación a escanear el código "
        "o a ingresar la cuenta; eco de los dígitos tecleados; confirmación de cuenta o de sesión QR "
        "válida; espera del envase; clase detectada; clasificación en curso; resultado de puntos "
        "(botella +15, lata +10); o error de acreditación con petición de reintento. Esta disposición "
        "sustituye una interfaz gráfica costosa por un canal de estado suficiente para un usuario no "
        "entrenado.",
    )

    heading(doc, "V.6 Identificación dual del usuario", level=2)
    nbody(
        doc,
        29,
        "El usuario autenticado en la aplicación del "
        "terminal (14) abre la vista de escaneo, captura el código (13) y dispara la función de armado "
        "(21). Dicha función verifica el token del usuario, localiza la máquina activa, cancela cualquier "
        "sesión armada previa del mismo usuario o de la misma máquina, e inserta una sesión (27) con "
        "estado armed, origen qr, vencimiento a sesenta segundos y contador de ítems en cero. Un índice "
        "único parcial garantiza que no coexisten dos sesiones armed para el mismo usuario ni para la "
        "misma máquina.",
    )
    nbody(
        doc,
        30,
        "El módulo controlador (5) interroga periódicamente la función de sondeo (22) enviando su "
        "código de máquina. Si existe una sesión armed no vencida, recibe el identificador de sesión, "
        "el número de cuenta y un nombre para mostrar, energiza el relé (10) y habilita la aceptación "
        "de detecciones. Cada acreditación exitosa incrementa items_processed, registra last_item_at y "
        "renueva expires_at en sesenta segundos, de modo que un usuario puede depositar varios envases "
        "en una misma visita sin reescanear, pero la máquina no queda ocupada de manera indefinida.",
    )
    nbody(
        doc,
        31,
        "Si el usuario no puede escanear, digita en el teclado (7) el número de cuenta (26) de seis "
        "dígitos que la plataforma asigna automáticamente al crear el perfil (25), mediante una "
        "secuencia que inicia en 100001 con relleno de ceros a la izquierda. La función (23) responde "
        "si la cuenta existe. La cuenta permanece activa sesenta segundos, análogamente a la sesión QR. "
        "Este respaldo permite usar la máquina con un teléfono sin cámara, con la cámara ocupada o con "
        "un usuario que memorizó su número.",
    )

    heading(doc, "V.7 Plataforma remota, aplicación y recompensas", level=2)
    nbody(
        doc,
        32,
        "La plataforma (15) mantiene, como mínimo, las entidades siguientes: perfiles de usuario (25) "
        "con saldo de puntos, puntos ecológicos del mes, número de cuenta, ciudad o departamento y rol "
        "(usuario u operador); máquinas con código, nombre, ubicación y estado activo; sesiones de "
        "reciclaje (27); transacciones de tipo bottle, can o redemption; catálogo de recompensas (28) "
        "con costo mínimo de 200 puntos y categorías de café, alimentos, bebidas y aperitivos; canjes "
        "con código de redención; ciudades; competencias mensuales; y resultados mensuales de ciudad y "
        "de usuario. El acceso está protegido por políticas de seguridad a nivel de fila: el usuario "
        "consulta su propio perfil, su historial y sus sesiones; el operador registra y actualiza "
        "máquinas; las funciones de máquina se invocan con clave de interfaz y, en el lado de servidor, "
        "con privilegio de servicio.",
    )
    nbody(
        doc,
        33,
        "La función de acreditación (24) recibe item_type igual a bottle o can, y al menos uno entre "
        "session_id, account_number o user_id. Si hay sesión, comprueba que esté armed, que no haya "
        "vencido y que el código de máquina coincida; en caso contrario responde conflicto y, si procede, "
        "marca la sesión como expired. Luego inserta la transacción (15 puntos para botella, 10 para lata), "
        "actualiza points_balance y monthly_eco_points, y, si hay sesión, incrementa el recuento y renueva "
        "el vencimiento. El terminal (14) se suscribe a los cambios de la sesión y del perfil, de manera "
        "que la pantalla de sesión muestra el número de envases procesados y el saldo se actualiza sin "
        "reconsultar de forma periódica.",
    )
    nbody(
        doc,
        34,
        "La aplicación móvil, realizada en una realización preferente sobre un marco de trabajo de "
        "aplicación nativa multiplataforma, comprende: registro y autenticación por correo electrónico; "
        "configuración de perfil (alias, nombre, edad o fecha de nacimiento, ciudad); tablero de saldo "
        "y acceso al escaneo; tienda de recompensas con canje y generación de código; historial de "
        "transacciones; ranking nacional y por ciudad, batalla de ciudades y medallas; perfil; y, para "
        "el rol operador, alta de máquinas con generación del código y del código bidimensional imprimible. "
        "El canje descuenta puntos y deja un comprobante. Nada de lo anterior constituye por sí solo el "
        "modelo de utilidad: se describe porque forma parte del sistema que da utilidad a la disposición "
        "física de la máquina.",
    )
    nbody(
        doc,
        35,
        "De manera opcional, un módulo de ranking territorial (29) agrega los puntos ecológicos del mes "
        "por ciudad o departamento, publica vistas de podio nacional y local, asigna medallas por volumen "
        "(bronce a partir de 50 puntos mensuales, plata a partir de 150, oro a partir de 300) y, al "
        "cerrar el mes calendario, congela resultados, reinicia el acumulado mensual y conserva el saldo "
        "canjeable. En una realización, el cierre se programa el día 1 a las 00:05 en la zona horaria "
        "local. Este módulo no es indispensable para clasificar envases, pero incrementa la utilidad del "
        "conjunto al convertir cada depósito en un dato comparable entre territorios.",
    )

    heading(doc, "V.8 Relaciones funcionales entre los elementos", level=2)
    nbody(
        doc,
        36,
        "La novedad no reside en el uso aislado de una cámara, un teclado o un servidor, sino en la "
        "disposición y la cooperación de los elementos. El módulo de visión (3) percibe y filtra; el "
        "enlace (6) transporta únicamente la clase aceptada; el módulo controlador (5) decide si el "
        "contexto de usuario lo permite, actúa el servomotor (9), señaliza con el relé (10) y la "
        "pantalla (8), y pide a la plataforma (15) que acredite. La plataforma, a su vez, solo acredita "
        "si la sesión (27) y el código de máquina son coherentes, o si la cuenta (26) existe. El terminal "
        "(14) es el medio con el que el usuario arma la sesión y observa el resultado. Quitar cualquiera "
        "de estos eslabones degrada la función: sin (3) no hay clasificación óptica local; sin (6) y (5) "
        "separados la cámara compite con el control; sin (13)/(21)/(22) o sin (7)/(23) no hay vinculación "
        "de usuario; sin (9)/(11)/(12) no hay separación material; sin (15)/(24) no hay incentivo auditable.",
    )

    # VI
    heading(doc, "VI. EJEMPLOS DE LA MEJOR FORMA DE REALIZAR LA INVENCIÓN")
    heading(doc, "VI.1 Ejemplo 1. Realización preferente de la máquina", level=2)
    nbody(
        doc,
        37,
        "Se construye la máquina recicladora de envases (1) con un gabinete de material rígido, por ejemplo madera, lámina metálica o "
        "polímero, con una abertura superior (2) dimensionada para botellas PET de hasta 2 L y latas "
        "de 355 ml. En el interior, frente a la abertura, se fija una placa ESP32-CAM AI Thinker (3) "
        "con cámara OV2640 (4). En un compartimento separado, para reducir interferencias ópticas y "
        "eléctricas, se fija una placa ESP32 DevKit (5). Se une GND de ambas placas (18), se conecta "
        "GPIO14 de (3) a GPIO32 de (5) y se configura UART a 115200 baudios. Se cablea un teclado 4×4 "
        "(7), una LCD 1602 I2C (8) en GPIO21/GPIO22, un servomotor de 5 V (9) y un módulo de relé de "
        "un canal (10) en GPIO23, alimentado a 5 V desde (17). El brazo del servo cubre dos rampas que "
        "desembocan en recipientes (11) y (12).",
    )
    nbody(
        doc,
        38,
        "En (3) se carga un firmware que incluye el modelo de visión compilado, el umbral 0,75, tres "
        "detecciones consecutivas y 4000 ms de enfriamiento. En (5) se graban las credenciales de la "
        "red local, la URL de la plataforma (15), la clave de interfaz y el MACHINE_CODE, por ejemplo "
        "ECO-A1B2C3, idéntico al registrado por el operador y al impreso en (13). Tras el arranque, "
        "(8) muestra la invitación a escanear o a ingresar la cuenta, y (5) sondea (22) cada pocos "
        "segundos.",
    )

    heading(doc, "VI.2 Ejemplo 2. Flujo de sesión por código bidimensional", level=2)
    nbody(
        doc,
        39,
        "Un operador con rol admin abre la pestaña de administración, introduce el nombre y la "
        "ubicación de la máquina y obtiene el código ECO-A1B2C3 y su código bidimensional (13), que "
        "imprime y adhiere al gabinete. Un usuario registrado, con ciudad asignada y número de cuenta "
        "100017, abre la aplicación, pulsa escanear y lee (13). La función (21) crea la sesión (27). "
        "El controlador (5) recibe armed=true, enciende el relé (10) y muestra Insert item. El usuario "
        "introduce una botella. Tras tres inferencias bottle con confianza ≥ 0,75, (3) envía "
        "DETECT:bottle. El servo (9) desvía hacia (11). La función (24) suma 15 puntos, deja el saldo "
        "en el valor anterior más 15, incrementa monthly_eco_points y renueva la sesión. La vista de "
        "sesión en (14) muestra un ítem procesado y el nuevo saldo por el canal en tiempo real. Si el "
        "usuario deposita acto seguido una lata, el ciclo se repite con +10 puntos hacia (12). Si no "
        "deposita nada en sesenta segundos, la sesión pasa a expired y el relé se apaga.",
    )

    heading(doc, "VI.3 Ejemplo 3. Flujo de respaldo por teclado", level=2)
    nbody(
        doc,
        40,
        "El mismo usuario, sin usar la cámara del teléfono, teclea 1-0-0-0-1-7 y pulsa numeral. El "
        "controlador llama a (23), recibe valid=true, muestra Account valid / Insert item y habilita "
        "detecciones por sesenta segundos. El resto de la clasificación y acreditación es idéntico, "
        "salvo que (24) se invoca con account_number y sin session_id. Si el usuario pulsa asterisco, "
        "o si el número no existe, o si vence el temporizador, la cuenta activa se limpia y el relé "
        "(10) se desenergiza.",
    )

    heading(doc, "VI.4 Ejemplo 4. Canje y ranking", level=2)
    nbody(
        doc,
        41,
        "Acumulados 200 puntos o más, el usuario entra a la tienda (28) y canjea, por ejemplo, una "
        "recompensa de costo 200. Se genera un código de redención y el saldo disminuye en 200, sin "
        "afectar el historial de depósitos. Al cierre del mes, la función de finalización toma una "
        "instantánea de la batalla de ciudades y de los padrones nacional y local, asigna medallas "
        "según 50/150/300 puntos ecológicos del mes y pone monthly_eco_points en cero, conservando "
        "points_balance. El usuario consulta sus medallas en el perfil y el podio del mes anterior.",
    )

    heading(doc, "VI.5 Ejemplo 5. Variantes de realización", level=2)
    nbody(
        doc,
        42,
        "Sin apartarse de la invención, el módulo (3) puede emplear detección de objetos con cajas "
        "delimitadoras en lugar de clasificación global de imagen; el actuador (9) puede ser un "
        "solenoide, un motor de corriente continua con fin de carrera o una compuerta de dos posiciones; "
        "el relé (10) puede sustituirse por un LED o un zumbador; la pantalla (8) puede ser OLED; el "
        "enlace (6) puede implementarse en otro UART o, de manera equivalente, en un bus serie síncrono, "
        "siempre que el módulo de visión permanezca desacoplado de la red; la sesión puede tener un TTL "
        "distinto de sesenta segundos mientras sea finito y renovable; y las cuantías 15 y 10 puntos "
        "pueden parametrizarse en (24) sin alterar la disposición de los elementos. El ranking (29) "
        "puede omitirse. Lo esencial es la cooperación entre visión embarcada separada, identificación "
        "dual de usuario, clasificación electromecánica y acreditación remota validada.",
    )

    # VII
    heading(doc, "VII. APLICABILIDAD INDUSTRIAL")
    nbody(
        doc,
        43,
        "La máquina y el sistema descritos son susceptibles de fabricación en serie con componentes "
        "comerciales de electrónica embebida, impresión de gabinetes por corte, plegado o moldeo, y "
        "despliegue de la plataforma (15) en un proveedor de computación en la nube o en un servidor "
        "propio. No se requiere un hallazgo de laboratorio ni un material de propiedades desconocidas. "
        "Un técnico en electrónica y un técnico en software, siguiendo la presente descripción y las "
        "figuras, pueden reproducir el aparato y ponerlo en operación.",
    )
    nbody(
        doc,
        44,
        "La invención es aplicable, entre otros, en universidades, colegios, municipalidades, estaciones "
        "de transporte, edificios de oficinas, centros comerciales de escala media y conjuntos "
        "habitacionales, como infraestructura de recolección selectiva de PET y aluminio con incentivo "
        "inmediato. Permite instalar un parque de máquinas heterogéneas, cada una con su código (13), "
        "administradas por un operador, y obtener estadísticas por máquina, por usuario y por territorio. "
        "El resultado industrial es un equipo de recolección que clasifica, identifica y recompensa, "
        "con un costo y un volumen compatibles con puntos de generación de residuales que no justifican "
        "una máquina de devolución inversa de tipo supermercado.",
    )

    # VIII
    page_break(doc)
    heading(doc, "VIII. REIVINDICACIONES")
    body(
        doc,
        "Lo que se reivindica es:",
        first_line=False,
    )

    claim(
        doc,
        1,
        "Máquina recicladora de envases (1) que comprende una carcasa con una boca de ingreso (2) "
        "para un envase (19), medios de identificación de usuario y medios de comunicación con una "
        "plataforma remota (15), caracterizada porque comprende: "
        "un módulo de visión artificial (3) con cámara (4) y una unidad de inferencia visual embarcada "
        "(20) dispuesta para clasificar el envase (19) como botella o lata sin transmitir la imagen "
        "fuera de la máquina; "
        "un módulo controlador (5) separado del módulo de visión (3), provisto de un módulo de "
        "comunicación inalámbrica (16); "
        "un enlace de comunicación serie (6) entre el módulo de visión (3) y el módulo controlador (5), "
        "previsto para el envío de un mensaje de clase aceptada; "
        "un actuador de clasificación (9) gobernado por el módulo controlador (5) y asociado a un "
        "compartimento de botellas (11) y a un compartimento de latas (12); "
        "estando el módulo controlador (5) dispuesto para admitir el mensaje de clase únicamente en "
        "presencia de un contexto de usuario activo y, en tal caso, accionar el actuador (9) según la "
        "clase y solicitar a la plataforma remota (15) la acreditación de una recompensa asociada a esa clase.",
    )
    claim(
        doc,
        2,
        "Máquina según la reivindicación 1, caracterizada porque la unidad de inferencia visual (20) "
        "comprende un comparador de umbral de confianza, un acumulador de coincidencias consecutivas "
        "de una misma etiqueta rastreable y un temporizador de ventana de enfriamiento, conectados a "
        "la salida del enlace de comunicación serie (6).",
    )
    claim(
        doc,
        3,
        "Máquina según la reivindicación 2, caracterizada porque el comparador de umbral está ajustado "
        "a 0,75, el acumulador de coincidencias está ajustado a tres inferencias consecutivas, el "
        "temporizador de enfriamiento está ajustado a 4000 ms, y el enlace de comunicación serie (6) "
        "está previsto para transportar líneas ASCII DETECT:bottle o DETECT:can.",
    )
    claim(
        doc,
        4,
        "Máquina según cualquiera de las reivindicaciones 1 a 3, caracterizada porque los medios de "
        "identificación de usuario comprenden un código bidimensional (13) fijo sobre la máquina (1), "
        "cuyo contenido identifica de manera unívoca a dicha máquina y está dispuesto para ser leído "
        "por un terminal móvil (14), y porque el módulo controlador (5) está acoplado a la plataforma "
        "(15) mediante el módulo de comunicación inalámbrica (16) para adoptar una sesión de reciclaje "
        "(27) de duración finita como contexto de usuario activo.",
    )
    claim(
        doc,
        5,
        "Máquina según la reivindicación 4, caracterizada porque la sesión de reciclaje (27) está "
        "configurada con un tiempo de vida inicial de sesenta segundos, con exclusión mutua por "
        "usuario y por máquina, y con renovación vinculada a la acreditación de un envase.",
    )
    claim(
        doc,
        6,
        "Máquina según cualquiera de las reivindicaciones 1 a 5, caracterizada porque los medios de "
        "identificación de usuario comprenden además un teclado matricial (7) conectado al módulo "
        "controlador (5) para el ingreso de un número de cuenta (26) de seis dígitos, validable en "
        "la plataforma (15).",
    )
    claim(
        doc,
        7,
        "Máquina según cualquiera de las reivindicaciones 1 a 6, caracterizada porque comprende una "
        "pantalla de cristal líquido (8) conectada al módulo controlador (5) por bus I2C, prevista "
        "para mostrar el estado de espera, de cuenta o sesión válida, de detección, de clasificación "
        "y de acreditación o error.",
    )
    claim(
        doc,
        8,
        "Máquina según cualquiera de las reivindicaciones 1 a 7, caracterizada porque comprende un "
        "relé (10) conectado al módulo controlador (5) y asociado al estado de contexto de usuario "
        "activo.",
    )
    claim(
        doc,
        9,
        "Máquina según cualquiera de las reivindicaciones 1 a 8, caracterizada porque el módulo de "
        "visión (3) es una placa con microcontrolador y cámara integrada sin pila de red de aplicación, "
        "el módulo controlador (5) es una placa con microcontrolador y WiFi, el enlace (6) es UART a "
        "115200 baudios, y ambos módulos comparten tierra común (18).",
    )
    claim(
        doc,
        10,
        "Máquina según cualquiera de las reivindicaciones 1 a 9, caracterizada porque el módulo "
        "controlador (5) está conectado a la plataforma (15) para transmitir, junto con la clase, el "
        "identificador de sesión y el código de máquina, o el número de cuenta, y porque la plataforma "
        "(15) asocia quince puntos a la clase botella y diez puntos a la clase lata.",
    )
    claim(
        doc,
        11,
        "Sistema de reciclaje incentivado, que comprende una máquina según cualquiera de las "
        "reivindicaciones 1 a 10, un terminal móvil (14) y una plataforma remota de datos (15), "
        "caracterizado porque la plataforma (15) almacena perfiles de usuario (25), un registro de "
        "máquinas, sesiones de reciclaje (27) y transacciones, y comprende funciones de armado de sesión "
        "(21), sondeo de sesión (22), validación de cuenta (23) y acreditación de puntos (24), y porque "
        "el terminal (14) está dispuesto para autenticar al usuario, leer el código bidimensional (13), "
        "mostrar el estado de la sesión y el saldo, y canjear recompensas (28) a partir de un umbral "
        "de puntos.",
    )
    claim(
        doc,
        12,
        "Sistema según la reivindicación 11, caracterizado porque la plataforma (15) incluye un módulo "
        "de ranking territorial (29) de agregación de puntos ecológicos mensuales por ciudad o "
        "departamento, con umbrales de medalla de 50, 150 y 300 puntos mensuales y archivo de podio "
        "al cierre de cada mes calendario, conservando el saldo canjeable del perfil (25).",
    )

    # IX
    page_break(doc)
    heading(doc, "IX. RESUMEN")
    nbody(
        doc,
        45,
        "Máquina recicladora de envases y sistema asociado. La máquina recicladora de envases (1) "
        "presenta una boca de ingreso (2), un módulo de visión artificial embarcado (3, 4, 20) que "
        "clasifica botellas y latas sin enviar la imagen a un servidor, un módulo controlador separado "
        "(5) unido por UART (6), un actuador (9) que desvía el envase a compartimentos distintos "
        "(11, 12), identificación dual del usuario mediante código bidimensional (13) o teclado (7), "
        "pantalla (8) y relé de estado (10). El controlador admite una detección si hay sesión o cuenta "
        "activa, con confirmación por inferencias consecutivas y una ventana de enfriamiento, y pide a "
        "una plataforma remota (15) la acreditación de puntos (botella +15, lata +10) validando la "
        "sesión y el código de máquina. Un terminal móvil (14) arma la sesión, muestra el saldo y "
        "permite el canje. La disposición resuelve, con un aparato compacto, la clasificación local, "
        "la vinculación segura al usuario y el incentivo inmediato, frente a contenedores pasivos y a "
        "máquinas industriales de devolución inversa basadas en código de barras, RFID y cupón impreso.",
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    r = p.add_run("Palabras clave: ")
    set_run_font(r, size=11, bold=True)
    r2 = p.add_run(
        "máquina recicladora; envase PET; lata de aluminio; visión artificial embarcada; "
        "UART; sesión por código bidimensional; teclado de cuenta; clasificación por servo; "
        "acreditación remota de puntos; reverse vending."
    )
    set_run_font(r2, size=11)

    # X
    page_break(doc)
    heading(doc, "X. FIGURAS")
    body(
        doc,
        "A continuación se anexan las figuras FIG. 1 a FIG. 7, ejecutadas en líneas negras, con los "
        "signos de referencia empleados en la descripción y en las reivindicaciones.",
        first_line=False,
    )

    add_figure(doc, "FIG1.png", "FIG. 1")
    add_figure(doc, "FIG2.png", "FIG. 2")
    add_figure(doc, "FIG3.png", "FIG. 3")
    add_figure(doc, "FIG4.png", "FIG. 4")
    add_figure(doc, "FIG5.png", "FIG. 5")
    add_figure(doc, "FIG6.png", "FIG. 6")
    add_figure(doc, "FIG7.png", "FIG. 7")

    doc.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    build()
