import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.ai import free_chain as fc


class ChainTests(unittest.TestCase):
    def test_allowed(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'config.json'
            p.write_text(json.dumps({'routes': [{'provider':'google', 'model':'google/gemma-4-31b-it','enabled': True}]}))
            self.assertEqual(len(fc.load_routes(p)), 1)

    def test_paid_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'config.json'
            p.write_text(json.dumps({'routes': [{'provider':'openrouter', 'model':'openrouter/auto','enabled':True}]}))
            with self.assertRaises(ValueError):
                fc.load_routes(p)

    def test_quota_structured_error(self):
        s = json.dumps({'type':'error','properties':{'error':{'name':'RateLimitError', 'message':'429 RESOURCE_EXHAUSTED'}}})
        self.assertEqual(fc.error_report(s, 0), (False, 'cuota'))

    def test_groq_single_request_oversized_structured(self):
        error = ("Request too large for model `openai/gpt-oss-120b` in organization "
                 "`org_example` service tier `on_demand` on tokens per minute (TPM): "
                 "Limit 8000, Requested 9357, please reduce your message size")
        payload = json.dumps({'type': 'error', 'properties': {'error': {'message': error}}})
        self.assertEqual(fc.error_report(payload, 0), (False, 'petición supera TPM'))

    def test_groq_single_request_oversized_plain(self):
        error = ("Error: Request too large for model `openai/gpt-oss-120b` "
                 "on tokens per minute (TPM): Limit 8000, Requested 9357")
        self.assertEqual(fc.error_report(error, 1), (False, 'petición supera TPM'))
        self.assertEqual(fc.error_report(error, 0), (False, 'petición supera TPM'))

    def test_groq_oversized_falls_back_to_openrouter(self):
        data = [
            {'provider': 'groq', 'model': 'groq/openai/gpt-oss-120b', 'enabled': True},
            {'provider': 'openrouter', 'model': 'openrouter/openrouter/free', 'enabled': True},
        ]
        calls = []
        def simulate_run(cmd, **kw):
            calls.append(cmd)
            if len(calls) == 1:
                return subprocess.CompletedProcess(cmd, 1, '', 'Request too large for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Requested 9357')
            return subprocess.CompletedProcess(cmd, 0, json.dumps({'type': 'message.part.updated', 'properties': {'part': {'type': 'text', 'text': 'OK'}}}), '')
        args = type('X', (), dict(task='R2.7', list=False, dry_run=False, session=None, timeout=30))()
        with patch.object(fc, 'load_routes', return_value=data), \
             patch.object(fc.shutil, 'which', return_value='/usr/bin/opencode'), \
             patch.object(fc.subprocess, 'run', side_effect=simulate_run), \
             patch.object(fc, 'save_state'):
            self.assertEqual(fc.execute(args), 0)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1][calls[1].index('--model') + 1], 'openrouter/openrouter/free')

    def test_free_limit(self):
        self.assertEqual(fc.error_report("You've used today's free messages.", 1), (False,'cuota'))

    def test_quota_plaintext_exit_zero(self):
        self.assertEqual(fc.error_report("You've used today's free messages.", 0), (False, 'cuota'))

    def test_ignore_regular_text(self):
        s=json.dumps({'type':'message.part.updated', 'properties':{'part':{'type':'text','text':'429 errors can happen'}}})
        self.assertEqual(fc.error_report(s,0),(True,'completado'))

    def test_unknown_error_stops(self):
        self.assertIn('no se cambia', fc.error_report('RuntimeError: permission denied writing file', 1)[1])

    def test_session(self):
        s=json.dumps({'type':'message.part.updated','properties':{'sessionID':'ses_ABC123','part':{'type':'text','text':'OK'}}})
        self.assertEqual(fc.session_id(s), 'ses_ABC123')

    def test_resume_prompt_safe(self):
        text=fc.resume_prompt('R2.7', [{'provider':'opencode'}])
        self.assertIn('Conserva TODOS los cambios', text)
        self.assertIn('R2.7', text)

    def test_check_models_compatible_con_cli(self):
        routes = [
            {'provider': 'google', 'model': 'google/gemma-4-31b-it', 'enabled': True},
            {'provider': 'groq', 'model': 'groq/openai/gpt-oss-120b', 'enabled': True},
            {'provider': 'openrouter', 'model': 'openrouter/openrouter/free', 'enabled': True},
        ]
        listing = '\n'.join(r['model'] for r in routes)
        with patch.object(fc.subprocess, 'run', return_value=subprocess.CompletedProcess(['opencode', 'models'], 0, listing, '')) as run:
            self.assertEqual(fc.check_models(routes), 0)
            self.assertEqual(run.call_args.args[0], ['opencode', 'models'])

    def test_fallback_then_success(self):
        with tempfile.TemporaryDirectory() as d:
            data=[{'provider':'opencode','model':'opencode/deepseek-v4.1-flash-free','enabled':True},
                  {'provider':'google','model':'google/gemma-4-31b-it','enabled':True}]
            calls=[]
            def simulate_run(cmd, **kw):
                calls.append(cmd)
                if len(calls)==1:
                    return subprocess.CompletedProcess(cmd, 1, "", "429 rate limit")
                return subprocess.CompletedProcess(cmd, 0,
                    json.dumps({'type':'message.part.updated', 'properties':{'sessionID':'ses_ABC','part':{'type':'text','text':'Done'}}}),"")
            args=type('X',(),dict(task='R2.7',list=False,dry_run=False,session=None,timeout=30))()
            with patch.object(fc, 'load_routes',return_value=data), \
                 patch.object(fc.shutil, 'which',return_value='/usr/bin/opencode'), \
                 patch.object(fc.subprocess,'run',side_effect=simulate_run), \
                 patch.object(fc,'save_state'):
                self.assertEqual(fc.execute(args), 0)
            self.assertEqual(len(calls),2)
            self.assertEqual(calls[1][calls[1].index('--model')+1],'google/gemma-4-31b-it')

if __name__=='__main__':
    unittest.main()
