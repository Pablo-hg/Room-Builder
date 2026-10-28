import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).parent / "codex_quota_handoff.py"
spec = importlib.util.spec_from_file_location("codex_guard", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class HookTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / "demo.txt").write_text("original\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(self.root), "add", "demo.txt"], check=True)
        subprocess.run(["git", "-C", str(self.root), "-c", "user.name=Prueba", "-c", "user.email=test@example.com", "commit", "-qm", "base"], check=True)
        (self.root / "demo.txt").write_text("cambio local\n", encoding="utf-8")
        mod.make_dir(self.root)
    def tearDown(self):
        self.temp.cleanup()
    def test_bloqueo_cuando_queda_4_por_ciento(self):
        e = {"hook_event_name": "UserPromptSubmit", "prompt": "Continúa R2", "model": "gpt-6.1-terra", "session_id":"x"}
        quota = {"windows": [{"kind":"primary", "used":96.0, "mins":300}],"low": True,"checkedAt":100.0}
        state = {}
        out = mod.handle(e,self.root,state,quota)
        self.assertEqual(out.get("decision"), "block")
        doc=(self.root/".ai"/"CODEX_HANDOFF.md").read_text()
        self.assertIn("Continúa R2",doc)
        self.assertIn("demo.txt",doc)
        self.assertIn("4.0% restante",doc)
    def test_no_bloqueo_con_margen(self):
        out=mod.handle({"hook_event_name":"UserPromptSubmit", "prompt":"Empieza"},self.root,{},
              {"windows":[{"kind":"primary","used":90.0,"mins":300}],"low":False,"checkedAt":100.0})
        self.assertEqual(out,{})
    def test_aviso_a_mitad_de_trabajo(self):
        out=mod.handle({"hook_event_name":"PostToolUse"},self.root,{},
              {"windows":[{"kind":"secondary","used":95.0,"mins":10080}],"low":True,"checkedAt":100.0})
        self.assertIn("systemMessage",out)
        self.assertNotIn("decision",out)
    def test_no_copia_token_aparente(self):
        out=mod.redact("api_key=secreto123 token:abcde12345",200)
        self.assertNotIn("secreto123",out)
        self.assertNotIn("abcde12345",out)

if __name__ == '__main__':
    unittest.main()
