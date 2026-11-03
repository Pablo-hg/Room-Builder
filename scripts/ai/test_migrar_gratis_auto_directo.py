import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from migrar_gratis_auto_directo import migrate, parse_jsonc, run

OLD = {
    "model": "openai/gpt-6.1-terra",
    "plugin": ["opencode-runtime-fallback@0.3.0"],
    "commands": {
        "gratis-auto": {"agent": "selector-gratuito", "model": "opencode/glm-5.3-flash-free", "template": "delegar a subagentes"},
        "gratis": {"model": "opencode/deepseek-v4.1-flash-free", "template": "sin tocar"},
        "traspaso-codex": {"model": "opencode/deepseek-v4.1-flash-free"},
    },
    "agent": {
        "selector-gratuito": {
            "description": "selector anterior", "mode": "primary", "model": "opencode/glm-5.3-flash-free",
            "fallback_models": ["google/gemma-4-31b-it", "openrouter/openrouter/free"],
            "permissions": [
                {"action": "edit", "resource": "*", "effect": "deny"},
                {"action": "subagent", "resource": "*", "effect": "deny"},
                {"action": "subagent", "resource": "rb-gratis-desarrollo", "effect": "allow"},
                {"action": "shell", "resource": "dangerous", "effect": "deny"},
            ],
        },
        "rb-gratis-desarrollo": {"mode": "subagent", "model": "opencode/deepseek-v4.1-flash-free"},
    },
}


class MigrationTests(unittest.TestCase):
    def test_direct_and_fallback(self):
        cfg = migrate(OLD)
        a = cfg["agent"]["gratis-auto"]
        self.assertNotIn("selector-gratuito", cfg["agent"])
        self.assertIn("rb-gratis-desarrollo", cfg["agent"])
        self.assertEqual(cfg["commands"]["gratis-auto"]["agent"], "gratis-auto")
        self.assertIn("directamente", cfg["commands"]["gratis-auto"]["template"])
        self.assertNotIn("delegarla", cfg["commands"]["gratis-auto"]["template"])
        self.assertEqual(a["fallback_models"], OLD["agent"]["selector-gratuito"]["fallback_models"])
        self.assertNotIn({"action": "edit", "resource": "*", "effect": "deny"}, a["permissions"])
        self.assertIn({"action": "shell", "resource": "dangerous", "effect": "deny"}, a["permissions"])
        self.assertEqual([x for x in a["permissions"] if x["action"] == "subagent"],
                         [{"action": "subagent", "resource": "*", "effect": "deny"}])

    def test_other_commands_unchanged(self):
        old = copy.deepcopy(OLD)
        new = migrate(old)
        self.assertEqual(old, OLD)
        for name in ["gratis", "traspaso-codex"]:
            self.assertEqual(new["commands"][name], old["commands"][name])
        self.assertEqual(new["plugin"], old["plugin"])

    def test_accept_old_agents_key(self):
        v = copy.deepcopy(OLD)
        v["agents"] = v.pop("agent")
        self.assertIn("gratis-auto", migrate(v)["agents"])

    def test_refuse_paid_fallback(self):
        v = copy.deepcopy(OLD)
        v["agent"]["selector-gratuito"]["fallback_models"] = ["openrouter/paid-model"]
        with self.assertRaisesRegex(ValueError, "no autorizados"):
            migrate(v)

    def test_idempotent(self):
        once = migrate(OLD)
        self.assertEqual(once, migrate(once))

    def test_jsonc_comments_and_trailing_comma(self):
        self.assertEqual(parse_jsonc('''{
// comment
"agent": {"x": "http://hi",}, /* last */
}'''), {"agent": {"x": "http://hi"}})
        self.assertEqual(parse_jsonc('{"text": "literal ,} and ,] inside",}'),
                         {"text": "literal ,} and ,] inside"})

    def test_real_config_backup_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            file = root / "opencode.jsonc"
            file.write_text(json.dumps(OLD), encoding="utf-8")
            self.assertIn("SIMULACIÓN", run(root))
            self.assertEqual(json.loads(file.read_text()), OLD)
            self.assertIn("ACTUALIZADO", run(root, True))
            new = json.loads(file.read_text())
            self.assertEqual(new["commands"]["gratis-auto"]["agent"], "gratis-auto")
            self.assertEqual(len(list((root / ".ai" / "backups").glob("*.bak"))), 1)
            self.assertIn("YA ACTUALIZADO", run(root, True))

    def test_reject_conflicts(self):
        v = copy.deepcopy(OLD)
        v["agent"]["gratis-auto"] = {"model": "opencode/glm-5.3-flash-free"}
        with self.assertRaisesRegex(ValueError, "ambos"):
            migrate(v)


if __name__ == "__main__":
    unittest.main()
