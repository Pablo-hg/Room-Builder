# Parche Room Builder free-chain v4

Corrige la detección de error Groq: «Request too large ... tokens per minute (TPM): Limit ..., Requested ...».
Lo clasifica como límite de capacidad de petición y salta al siguiente proveedor gratuito permitido, sin reintentar el mismo error.
No modifica free_chain.json, opencode.jsonc, claves ni AGENTS.md.

Desde la raíz de Room-Builder:

```sh
mkdir -p /tmp/room-builder-free-chain-v3-backup
cp scripts/ai/free_chain.py scripts/ai/test_free_chain.py /tmp/room-builder-free-chain-v3-backup/
unzip -o ~/Descargas/room_builder_free_chain_v4_groq_tpm.zip -d .
python3 -m unittest scripts.ai.test_free_chain
python3 scripts/ai/free_chain.py --dry-run
```

Para probar solo las credenciales de Groq con contexto reducido:

```sh
(cd /tmp && opencode run --model groq/openai/gpt-oss-120b 'Responde únicamente OK. No modifiques archivos.')
```

No usar ese directorio para desarrollar Room Builder; es únicamente una comprobación de conexión.
No activar Groq si su límite de 8.000 tokens por minuto bloquea el contexto del proyecto.
