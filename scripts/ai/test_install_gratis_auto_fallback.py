import json
import tempfile
import unittest
from pathlib import Path
from scripts.ai import install_gratis_auto_fallback as mod


def baseline():
    return {
        '$schema': 'https://opencode.ai/config.json',
        'model': 'openai/gpt-6.1-terra',
        'commands': {'gratis-auto': {'agent': 'selector-gratuito', 'model': mod.PRIMARIES['selector-gratuito'],
                                    'template': 'Conserva el contexto $ARGUMENTS'}},
        'agents': {name: {'model': model, 'mode': 'subagent' if name != 'selector-gratuito' else 'primary'}
                   for name, model in mod.PRIMARIES.items()},
    }


class Tests(unittest.TestCase):
    def test_preserve_commands(self):
        original = baseline(); original['commands']['gratis'] = {'model':'opencode/deepseek-v4.1-flash-free'}
        res = mod.update_config(original)
        self.assertEqual(res['commands']['gratis'], original['commands']['gratis'])
        self.assertEqual(res['model'], original['model'])
        self.assertNotIn('plugin', original)
        self.assertEqual(res['plugin'], [mod.PLUGIN])
        for name in mod.PRIMARIES:
            self.assertTrue(all(m in mod.SAFE for m in res['agents'][name]['fallback_models']))

    def test_double_install_is_idempotent(self):
        a = mod.update_config(baseline())
        b = mod.update_config(a)
        self.assertEqual(a, b)

    def test_refuses_paid_model(self):
        b = baseline(); b['agents']['rb-gratis-desarrollo']['model'] = 'openai/gpt-6.1-sol'
        with self.assertRaises(ValueError): mod.update_config(b)

    def test_refuses_unknown_custom_agent_fallback(self):
        b = baseline(); b['agents']['selector-gratuito']['fallback_models'] = ['other/paid']
        with self.assertRaises(ValueError): mod.update_config(b)

    def test_preserve_other_plugins(self):
        b = baseline(); b['plugin'] = ['existing-useful-plugin']
        self.assertEqual(mod.update_config(b)['plugin'], ['existing-useful-plugin', mod.PLUGIN])

    def test_comments_trailing_commas(self):
        source = '{ // test\n "url": "https://example.com/path//file", /* foo */ "items": [1,2,], }'
        self.assertEqual(mod.jsonc_load(source), {'url':'https://example.com/path//file','items':[1,2]})

    def test_apply_and_backup(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root/'opencode.jsonc').write_text(json.dumps(baseline()), encoding='utf-8')
            mod.run(root, True)
            self.assertTrue(list((root/'.ai/backups').glob('opencode.jsonc.backup-*')))
            self.assertEqual(mod.jsonc_load((root/'opencode.jsonc').read_text())['agents']['selector-gratuito']['fallback_models'], mod.GENERAL)
            self.assertEqual(mod.jsonc_load((root/'.opencode/opencode-fallback.jsonc').read_text())['fallback_models'], [])

    def test_preview_does_not_write(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); p=root/'opencode.jsonc'; p.write_text(json.dumps(baseline()))
            before = p.read_text()
            mod.run(root)
            self.assertEqual(before,p.read_text())
            self.assertFalse((root/'.opencode').exists())

    def test_existing_plugin_file_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); (root/'opencode.jsonc').write_text(json.dumps(baseline()))
            (root/'.opencode').mkdir(); (root/'.opencode/opencode-fallback.jsonc').write_text('{}')
            with self.assertRaises(ValueError): mod.run(root, True)
            self.assertNotIn('plugin', json.loads((root/'opencode.jsonc').read_text()))

    def test_visual_fallback_visual_first(self):
        self.assertIn('super-vl:free',mod.FALLBACKS['rb-gratis-visual'][0])

if __name__=='__main__': unittest.main()
