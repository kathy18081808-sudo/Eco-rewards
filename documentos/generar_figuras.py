#!/usr/bin/env python3
"""Figuras en estilo de dibujo técnico (líneas negras) para el documento de modelo de utilidad."""

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch, Rectangle

OUT = Path(__file__).resolve().parent / "figuras"
OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "axes.linewidth": 0,
        "figure.facecolor": "white",
        "savefig.facecolor": "white",
        "savefig.dpi": 220,
    }
)


def new_fig(w=11.0, h=8.0):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    return fig, ax


def box(ax, x, y, w, h, text, lw=1.4, fs=8.5, ha="center"):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.15,rounding_size=0.8",
            linewidth=lw,
            edgecolor="black",
            facecolor="white",
        )
    )
    ax.text(x + w / 2, y + h / 2, text, ha=ha, va="center", fontsize=fs, wrap=True)


def arrow(ax, x1, y1, x2, y2, text=None):
    ax.add_patch(
        FancyArrowPatch(
            (x1, y1),
            (x2, y2),
            arrowstyle="-|>",
            mutation_scale=12,
            linewidth=1.2,
            color="black",
            shrinkA=0,
            shrinkB=0,
        )
    )
    if text:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx, my + 1.6, text, ha="center", va="bottom", fontsize=7.5)


def callout(ax, x, y, n):
    ax.add_patch(Circle((x, y), 1.55, fill=True, facecolor="white", edgecolor="black", lw=1.1))
    ax.text(x, y, str(n), ha="center", va="center", fontsize=8, fontweight="bold")


def save(fig, name):
    path = OUT / name
    fig.savefig(path, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print("wrote", path)


def fig1():
    fig, ax = new_fig()
    ax.text(50, 96, "FIG. 1", ha="center", va="top", fontsize=13, fontweight="bold")

    box(ax, 6, 42, 26, 28, "Terminal móvil\ndel usuario\n(14)", fs=9)
    callout(ax, 32, 72, 14)

    box(ax, 37, 32, 26, 48, "Máquina recicladora\n(1)\n\nVisión (3)\nControlador (5)\nClasificación (9)", fs=9)
    callout(ax, 63, 82, 1)

    box(ax, 70, 42, 24, 28, "Plataforma remota\nde datos\n(15)", fs=9)
    callout(ax, 94, 72, 15)

    arrow(ax, 32, 62, 37, 62, "código QR (13)")
    arrow(ax, 63, 58, 70, 58, "WiFi (16)")
    ax.plot([82, 82, 19, 19], [42, 26, 26, 42], color="black", lw=1.2)
    ax.annotate("", xy=(19, 42), xytext=(19, 29), arrowprops=dict(arrowstyle="-|>", color="black", lw=1.2))
    ax.text(50, 27.4, "puntos / estado", ha="center", va="bottom", fontsize=7.5)

    box(ax, 8, 8, 84, 14, "El usuario arma una sesión desde (14), deposita el envase (19) en (1),\n(3) lo clasifica, (5) lo desvía y (15) acredita la recompensa en tiempo real.", fs=8)
    save(fig, "FIG1.png")


def draw_keypad(ax, x, y, w, h, rows=4, cols=4):
    ax.add_patch(Rectangle((x, y), w, h, fill=False, lw=1.15))
    pad = 0.18
    cw, ch = w / cols, h / rows
    for i in range(rows):
        for j in range(cols):
            ax.add_patch(
                Rectangle(
                    (x + (j + pad) * cw, y + (i + pad) * ch),
                    cw * (1 - 2 * pad),
                    ch * (1 - 2 * pad),
                    fill=False,
                    lw=0.55,
                )
            )


def draw_qr(ax, x, y, s):
    ax.add_patch(Rectangle((x, y), s, s, fill=False, lw=1.15))
    finder = s * 0.22
    inset = s * 0.05
    for fx, fy in (
        (x + inset, y + s - inset - finder),
        (x + s - inset - finder, y + s - inset - finder),
        (x + inset, y + inset),
    ):
        ax.add_patch(Rectangle((fx, fy), finder, finder, fill=False, lw=0.8))
        ax.add_patch(
            Rectangle(
                (fx + finder * 0.28, fy + finder * 0.28),
                finder * 0.44,
                finder * 0.44,
                facecolor="black",
                edgecolor="black",
                lw=0.3,
            )
        )


def fig2():
    fig, ax = new_fig(9.2, 13.2)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 138)
    ax.text(50, 136, "FIG. 2", ha="center", va="top", fontsize=14, fontweight="bold")

    # Gabinete (1), proporción alta como el prototipo
    cab_x, cab_y, cab_w, cab_h = 20, 14, 60, 110
    ax.add_patch(Rectangle((cab_x, cab_y), cab_w, cab_h, fill=False, lw=2.0))
    callout(ax, cab_x - 4, cab_y + cab_h - 2, 1)

    # Franja diagonal izquierda, sin cruzar la boca de ingreso
    ax.plot(
        [cab_x, cab_x + 11],
        [cab_y + 54, cab_y + 92],
        color="black",
        lw=1.0,
        solid_capstyle="round",
    )

    # LCD (8) — ventana superior derecha
    lcd_x, lcd_y, lcd_w, lcd_h = 62.5, 112.5, 13, 5.2
    ax.add_patch(FancyBboxPatch((lcd_x, lcd_y), lcd_w, lcd_h, boxstyle="round,pad=0.12,rounding_size=0.4", linewidth=1.2, edgecolor="black", facecolor="white"))
    callout(ax, lcd_x + lcd_w + 3.2, lcd_y + lcd_h / 2, 8)

    # Teclado 4x4 (7)
    pad_x, pad_y, pad_w, pad_h = 64.2, 97.5, 10.2, 12.2
    draw_keypad(ax, pad_x, pad_y, pad_w, pad_h)
    callout(ax, pad_x + pad_w + 3.4, pad_y + pad_h / 2, 7)

    # Código QR (13)
    qr_s = 10.2
    qr_x, qr_y = 64.2, 84.5
    draw_qr(ax, qr_x, qr_y, qr_s)
    callout(ax, qr_x + qr_s + 3.4, qr_y + qr_s / 2, 13)

    # Relé / indicador (10), junto al bloque de control
    ax.add_patch(Circle((67.5, 81.4), 1.15, fill=False, lw=1.1))
    callout(ax, 72.8, 81.4, 10)

    # Boca de ingreso (2): abertura cuadrada centrada-izquierda, con profundidad
    inn_x, inn_y, inn_w, inn_h = 32.5, 72.5, 24, 22
    ax.add_patch(Rectangle((inn_x, inn_y), inn_w, inn_h, fill=False, lw=1.6))
    ax.add_patch(Rectangle((inn_x + 2.2, inn_y + 2.2), inn_w - 4.4, inn_h - 4.4, fill=False, lw=1.0))
    ax.plot([inn_x, inn_x + 2.2], [inn_y + inn_h, inn_y + inn_h - 2.2], color="black", lw=0.8)
    ax.plot([inn_x + inn_w, inn_x + inn_w - 2.2], [inn_y + inn_h, inn_y + inn_h - 2.2], color="black", lw=0.8)
    ax.plot([inn_x, inn_x + 2.2], [inn_y, inn_y + 2.2], color="black", lw=0.8)
    ax.plot([inn_x + inn_w, inn_x + inn_w - 2.2], [inn_y, inn_y + 2.2], color="black", lw=0.8)
    callout(ax, inn_x - 5.4, inn_y + inn_h + 1.2, 2)

    # Cámara (4) al fondo de la boca, línea discontinua
    cam_x, cam_y, cam_w, cam_h = 38.5, 84.6, 12, 5.4
    ax.add_patch(Rectangle((cam_x, cam_y), cam_w, cam_h, fill=False, lw=1.0, linestyle=(0, (3, 2))))
    callout(ax, cam_x + cam_w / 2, inn_y + inn_h + 3.6, 4)

    # Línea de corte del interior inferior
    cut_y = 66.8
    ax.plot(
        [cab_x + 1.2, cab_x + cab_w - 1.2],
        [cut_y, cut_y],
        color="black",
        lw=0.9,
        linestyle=(0, (4, 2.5)),
    )

    # Aleta / rampa de clasificación (9)
    flap_x, flap_y, flap_w, flap_h = 36.5, 44.5, 27, 13.5
    ax.add_patch(Rectangle((flap_x, flap_y), flap_w, flap_h, fill=False, lw=1.25))
    ax.plot([flap_x, flap_x + flap_w], [flap_y + flap_h * 0.55, flap_y + flap_h * 0.55], color="black", lw=0.7)
    # servo en el borde inferior de la aleta, como en el prototipo
    servo_w, servo_h = 7.2, 5.2
    servo_x = 50 - servo_w / 2
    servo_y = flap_y - 0.2
    ax.add_patch(Rectangle((servo_x, servo_y), servo_w, servo_h, fill=False, lw=1.2))
    callout(ax, 50, flap_y + flap_h + 2.6, 9)
    # flechas de basculación hacia cada contenedor
    arrow(ax, flap_x - 0.4, flap_y + 5.2, 31.5, flap_y + 5.2)
    arrow(ax, flap_x + flap_w + 0.4, flap_y + 5.2, 68.5, flap_y + 5.2)

    # Contenedor izquierdo (11)
    bin_h = 24
    ax.add_patch(Rectangle((22.8, 16.5), 19.5, bin_h, fill=False, lw=1.35))
    callout(ax, 21.2, 16.5 + bin_h / 2, 11)

    # Contenedor derecho (12)
    ax.add_patch(Rectangle((57.7, 16.5), 19.5, bin_h, fill=False, lw=1.35))
    callout(ax, 79.5, 16.5 + bin_h / 2, 12)

    save(fig, "FIG2.png")


def fig3():
    fig, ax = new_fig(12, 8.2)
    ax.text(50, 96, "FIG. 3", ha="center", va="top", fontsize=13, fontweight="bold")

    box(ax, 4, 58, 28, 24, "Módulo de visión (3)\nCámara (4)\nUnidad de inferencia (20)\nESP32-CAM", fs=8.5)
    callout(ax, 32, 84, 3)

    box(ax, 48, 50, 28, 36, "Módulo controlador (5)\nESP32\nWiFi (16)\nUART RX GPIO32", fs=8.5)
    callout(ax, 76, 88, 5)

    arrow(ax, 32, 70, 48, 70, "UART 115200 (6)")
    callout(ax, 40, 76, 6)

    box(ax, 4, 18, 18, 16, "Teclado\n(7)", fs=8)
    box(ax, 26, 18, 18, 16, "LCD I2C\n(8)", fs=8)
    box(ax, 48, 18, 18, 16, "Servo\n(9)", fs=8)
    box(ax, 70, 18, 18, 16, "Relé\n(10)", fs=8)

    arrow(ax, 13, 34, 56, 50)
    arrow(ax, 35, 34, 60, 50)
    arrow(ax, 57, 34, 62, 50)
    arrow(ax, 79, 34, 68, 50)

    box(ax, 82, 58, 14, 16, "Servidor\n(15)", fs=8)
    arrow(ax, 76, 66, 82, 66)

    ax.text(50, 8, "GND común (18). Alimentación (17). El módulo (3) no ejecuta HTTP; solo emite DETECT.", ha="center", fontsize=8)
    save(fig, "FIG3.png")


def fig4():
    fig, ax = new_fig(11.5, 13)
    ax.set_ylim(0, 130)
    ax.text(50, 127, "FIG. 4", ha="center", va="top", fontsize=13, fontweight="bold")

    steps = [
        (108, "Espera: escanear QR o ingresar cuenta"),
        (96, "¿Sesión armada o cuenta válida?"),
        (84, "Activar relé (10) y mostrar 'Insert item'"),
        (72, "Captura e inferencia visual (3)(20)"),
        (60, "¿3 detecciones consecutivas y cooldown?"),
        (48, "UART: DETECT:bottle o DETECT:can"),
        (36, "Actuar servo (9) hacia (11) o (12)"),
        (24, "Acreditar puntos en (15) y renovar TTL"),
        (12, "Actualizar app (14) en tiempo real"),
    ]
    for y, t in steps:
        box(ax, 22, y, 56, 9, t, fs=8.5)

    for i in range(len(steps) - 1):
        y1 = steps[i][0]
        y2 = steps[i + 1][0] + 9
        arrow(ax, 50, y1, 50, y2)

    box(ax, 82, 96, 14, 9, "No\nvolver", fs=7.5)
    arrow(ax, 78, 100.5, 82, 100.5)
    box(ax, 82, 60, 14, 9, "No\nesperar", fs=7.5)
    arrow(ax, 78, 64.5, 82, 64.5)
    save(fig, "FIG4.png")


def fig5():
    fig, ax = new_fig()
    ax.text(50, 96, "FIG. 5", ha="center", va="top", fontsize=13, fontweight="bold")

    box(ax, 8, 52, 34, 28, "ESP32-CAM (3)\nGPIO14 TX\n\nDETECT:bottle\\n\nDETECT:can\\n", fs=9)
    box(ax, 58, 52, 34, 28, "ESP32 controlador (5)\nGPIO32 RX\n\nIgnora si no hay sesión\nIgnora si está ocupado", fs=9)
    arrow(ax, 42, 66, 58, 66, "115200 8N1")

    box(
        ax,
        8,
        12,
        84,
        30,
        "Reglas: umbral de confianza 0,75; 3 inferencias consecutivas de la misma clase;\n"
        "ventana de enfriamiento 4000 ms; etiquetas bottle y can; tierra común (18).\n"
        "Tras aceptar, (5) mueve (9) y llama a acreditación de puntos (24).",
        fs=8.5,
    )
    save(fig, "FIG5.png")


def fig6():
    fig, ax = new_fig(12, 8.5)
    ax.text(50, 96, "FIG. 6", ha="center", va="top", fontsize=13, fontweight="bold")

    box(ax, 4, 58, 22, 24, "App móvil (14)\nAuth, QR, saldo,\ntienda, ranking", fs=8)
    box(ax, 32, 70, 16, 12, "arm-session\n(21)", fs=7.5)
    box(ax, 50, 70, 16, 12, "poll-session\n(22)", fs=7.5)
    box(ax, 68, 70, 16, 12, "validate-account\n(23)", fs=7.5)
    box(ax, 50, 52, 16, 12, "add-points\n(24)", fs=7.5)
    box(ax, 78, 48, 18, 22, "Base de datos\nperfiles (25)\nmáquinas\nsesiones (27)\ntransacciones", fs=7.5)

    arrow(ax, 26, 74, 32, 76)
    arrow(ax, 26, 66, 50, 58)
    arrow(ax, 66, 76, 78, 64)
    arrow(ax, 66, 58, 78, 58)

    box(ax, 4, 18, 92, 22, "Identificación dual: QR ecorewards://machine/ECO-XXXXXX (13) o cuenta de 6 dígitos (26).\n"
        "Una sola sesión armada por usuario y por máquina. TTL inicial 60 s, renovable al acreditar un envase.\n"
        "Puntos: botella +15; lata +10. Canje desde 200 puntos. Ranking territorial mensual con medallas.", fs=8)
    save(fig, "FIG6.png")


def fig7():
    fig, ax = new_fig()
    ax.text(50, 96, "FIG. 7", ha="center", va="top", fontsize=13, fontweight="bold")

    box(ax, 6, 62, 20, 16, "Usuario A\nescanea (13)", fs=8)
    box(ax, 32, 62, 20, 16, "arm-session\n(21)", fs=8)
    box(ax, 58, 62, 20, 16, "Sesión armada\n(27) 60 s", fs=8)
    box(ax, 84, 62, 12, 16, "poll\n(22)", fs=8)
    arrow(ax, 26, 70, 32, 70)
    arrow(ax, 52, 70, 58, 70)
    arrow(ax, 78, 70, 84, 70)

    box(ax, 6, 30, 40, 18, "Usuario B en la misma máquina\n→ sesión A se cancela", fs=8)
    box(ax, 54, 30, 40, 18, "El mismo usuario en otra máquina\n→ sesión previa se cancela", fs=8)

    box(ax, 6, 8, 88, 14, "La máquina (1) solo procesa detecciones mientras (27) esté armada y vigente,\no mientras una cuenta (26) validada por (23) permanezca activa.", fs=8)
    save(fig, "FIG7.png")


if __name__ == "__main__":
    fig1()
    fig2()
    fig3()
    fig4()
    fig5()
    fig6()
    fig7()
    print("done")
