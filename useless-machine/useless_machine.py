#!/usr/bin/env python3
"""
Useless Machine v1.0
A window whose only function is to close itself.
"""

import sys
from PyQt6.QtWidgets import QApplication, QWidget, QVBoxLayout, QPushButton, QLabel
from PyQt6.QtCore import Qt, QTimer, QPoint, pyqtSignal
from PyQt6.QtGui import QCursor, QFont, QFontDatabase, QPalette, QColor


# ── Aesthetic constants ────────────────────────────────────────────────────────
BG_COLOR        = "#0a0a0a"
PANEL_COLOR     = "#111111"
BORDER_COLOR    = "#2a2a2a"
TEXT_DIM        = "#444444"
TEXT_MID        = "#888888"
TEXT_BRIGHT     = "#cccccc"
BUTTON_IDLE_BG  = "#181818"
BUTTON_IDLE_FG  = "#cc3333"
BUTTON_IDLE_BD  = "#cc3333"
BUTTON_HOVER_BG = "#cc3333"
BUTTON_HOVER_FG = "#0a0a0a"
BUTTON_PRESS_BG = "#ff4444"
BUTTON_PRESS_FG = "#0a0a0a"

LERP_INTERVAL_MS  = 14      # ~70fps
LERP_SPEED        = 0.07    # 0–1; lower = slower, creamier drag
ARRIVAL_THRESHOLD = 4       # pixels — close enough to snap
PAUSE_BEFORE_MS   = 1200    # wait after window appears
PAUSE_AT_BTN_MS   = 350     # hover pause before clicking


STYLESHEET = f"""
QWidget#root {{
    background-color: {BG_COLOR};
}}

QWidget#panel {{
    background-color: {PANEL_COLOR};
    border: 1px solid {BORDER_COLOR};
}}

QLabel#title {{
    color: {TEXT_DIM};
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
}}

QLabel#flavor {{
    color: {TEXT_MID};
    font-size: 13px;
    letter-spacing: 1px;
}}

QLabel#subtext {{
    color: {TEXT_DIM};
    font-size: 10px;
    letter-spacing: 2px;
}}

QPushButton#close_btn {{
    background-color: {BUTTON_IDLE_BG};
    color: {BUTTON_IDLE_FG};
    border: 1px solid {BUTTON_IDLE_BD};
    padding: 18px 56px;
    font-size: 13px;
    letter-spacing: 5px;
    min-width: 220px;
}}

QPushButton#close_btn:hover {{
    background-color: {BUTTON_HOVER_BG};
    color: {BUTTON_HOVER_FG};
    border-color: {BUTTON_HOVER_BG};
}}

QPushButton#close_btn:pressed {{
    background-color: {BUTTON_PRESS_BG};
    color: {BUTTON_PRESS_FG};
    border-color: {BUTTON_PRESS_BG};
}}
"""


# ── Main window ────────────────────────────────────────────────────────────────
class UselessMachine(QWidget):

    def __init__(self):
        super().__init__()
        self._lerp_active = False
        self._cursor_pos  = QCursor.pos()   # float-precision shadow position
        self._cx = float(self._cursor_pos.x())
        self._cy = float(self._cursor_pos.y())

        self._build_ui()
        self._schedule_activation()

    # ── UI construction ────────────────────────────────────────────────────────
    def _build_ui(self):
        self.setObjectName("root")
        self.setWindowTitle("Useless Machine  v1.0")
        self.setFixedSize(480, 320)
        self.setWindowFlags(
            Qt.WindowType.Window |
            Qt.WindowType.WindowTitleHint |
            Qt.WindowType.CustomizeWindowHint
        )
        self.setStyleSheet(STYLESHEET)

        # Center on screen
        screen = QApplication.primaryScreen().geometry()
        self.move(
            (screen.width()  - self.width())  // 2,
            (screen.height() - self.height()) // 2,
        )

        root_layout = QVBoxLayout(self)
        root_layout.setContentsMargins(0, 0, 0, 0)

        # Inner panel with padding
        panel = QWidget(self)
        panel.setObjectName("panel")
        panel.setFixedSize(self.width(), self.height())
        panel_layout = QVBoxLayout(panel)
        panel_layout.setContentsMargins(48, 40, 48, 40)
        panel_layout.setSpacing(0)
        root_layout.addWidget(panel)

        # USELESS MACHINE label
        title = QLabel("USELESS MACHINE", panel)
        title.setObjectName("title")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        panel_layout.addWidget(title)

        panel_layout.addSpacing(32)

        # Flavor text
        flavor = QLabel("This application has one function.", panel)
        flavor.setObjectName("flavor")
        flavor.setAlignment(Qt.AlignmentFlag.AlignCenter)
        panel_layout.addWidget(flavor)

        panel_layout.addSpacing(36)

        # The button
        self.btn = QPushButton("CLOSE", panel)
        self.btn.setObjectName("close_btn")
        self.btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.btn.setCursor(Qt.CursorShape.ArrowCursor)
        self.btn.clicked.connect(QApplication.instance().quit)

        btn_wrapper = QVBoxLayout()
        btn_wrapper.setAlignment(Qt.AlignmentFlag.AlignCenter)
        btn_wrapper.addWidget(self.btn, alignment=Qt.AlignmentFlag.AlignCenter)
        panel_layout.addLayout(btn_wrapper)

        panel_layout.addSpacing(28)

        # Subtext
        sub = QLabel("[ you have no choice ]", panel)
        sub.setObjectName("subtext")
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        panel_layout.addWidget(sub)

        panel_layout.addStretch()

    # ── Timing / activation ────────────────────────────────────────────────────
    def _schedule_activation(self):
        """Wait a beat, then start creeping."""
        QTimer.singleShot(PAUSE_BEFORE_MS, self._start_lerp)

    def _start_lerp(self):
        # Snapshot current cursor
        pos = QCursor.pos()
        self._cx = float(pos.x())
        self._cy = float(pos.y())
        self._lerp_active = True

        self._lerp_timer = QTimer(self)
        self._lerp_timer.setInterval(LERP_INTERVAL_MS)
        self._lerp_timer.timeout.connect(self._lerp_step)
        self._lerp_timer.start()

    def _lerp_step(self):
        # Target: center of the button in global coords
        target = self.btn.mapToGlobal(
            QPoint(self.btn.width() // 2, self.btn.height() // 2)
        )
        tx, ty = float(target.x()), float(target.y())

        # Exponential ease toward target
        self._cx += (tx - self._cx) * LERP_SPEED
        self._cy += (ty - self._cy) * LERP_SPEED

        QCursor.setPos(int(self._cx), int(self._cy))

        # Arrived?
        dx = tx - self._cx
        dy = ty - self._cy
        if (dx * dx + dy * dy) ** 0.5 < ARRIVAL_THRESHOLD:
            self._lerp_timer.stop()
            QTimer.singleShot(PAUSE_AT_BTN_MS, self._fire)

    def _fire(self):
        self.btn.animateClick(120)   # visual press, then emits clicked()


# ── Entry point ────────────────────────────────────────────────────────────────
def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    # Dark palette baseline (Qt handles native chrome)
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window,    QColor(BG_COLOR))
    palette.setColor(QPalette.ColorRole.WindowText, QColor(TEXT_BRIGHT))
    app.setPalette(palette)

    window = UselessMachine()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
