from __future__ import annotations

import os
import platform
import sys
from collections import namedtuple


def _patch_windows_platform_detection() -> None:
    """Avoid stdlib WMI probes that hang on some Windows hosts."""
    if not sys.platform.startswith("win"):
        return

    machine = (
        os.environ.get("PROCESSOR_ARCHITECTURE")
        or os.environ.get("PROCESSOR_IDENTIFIER")
        or "AMD64"
    )
    node = os.environ.get("COMPUTERNAME") or "localhost"
    processor = os.environ.get("PROCESSOR_IDENTIFIER") or machine
    system = os.environ.get("OS") or "Windows_NT"

    safe_uname_result = namedtuple(
        "uname_result",
        ["system", "node", "release", "version", "machine", "processor"],
    )

    def _safe_machine() -> str:
        return machine

    def _safe_uname() -> object:
        return safe_uname_result(
            system,
            node,
            "",
            "",
            machine,
            processor,
        )

    platform.machine = _safe_machine
    platform.uname = _safe_uname


_patch_windows_platform_detection()
