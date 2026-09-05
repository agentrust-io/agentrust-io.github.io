"""Run the published Bash quickstart in a temporary directory, including exit 1."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile


class Blocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.current = [], None

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self.current = ""

    def handle_data(self, data):
        if self.current is not None:
            self.current += data

    def handle_endtag(self, tag):
        if tag == "pre":
            self.blocks.append(self.current)
            self.current = None


parser = Blocks()
parser.feed((Path(__file__).resolve().parents[1] / "quickstart/index.html").read_text(encoding="utf-8"))
install, config, policy, catalog, validate, start, deny, verify, *_ = parser.blocks
script = "set -eu\n" + "\n".join([install, config, policy, catalog, validate])
script += "\n" + start + " >runtime.log 2>&1 &\nruntime_pid=$!\n"
script += "trap 'kill $runtime_pid 2>/dev/null || true' EXIT\n"
script += '''
ready=0
for attempt in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8443/health; then ready=1; break; fi
  if ! kill -0 "$runtime_pid" 2>/dev/null; then cat runtime.log; exit 1; fi
  sleep 1
done
if [ "$ready" != 1 ]; then cat runtime.log; exit 1; fi
'''
script += "\n" + deny + " >denial.txt\ncat denial.txt\ngrep -q '403' denial.txt\ngrep -q 'POLICY_DENY' denial.txt\n"
script += "set +e\n" + verify + " >verification.txt 2>&1\nresult=$?\nset -e\ncat verification.txt\n"
script += "test $result -eq 1\ngrep -q 'partially_verified' verification.txt\ngrep -q 'CRYPTO-001' verification.txt\n"
with tempfile.TemporaryDirectory(prefix="agentrust-quickstart-") as temp:
    subprocess.run(["bash", "-c", script], cwd=temp, check=True, timeout=240)
print("PASS published quickstart: 403 POLICY_DENY, signed session record, expected software-mode verification exit 1")
