#!/usr/bin/env python3
"""Three-way source reconciliation against the last verified deployment.

Runtime databases, secrets, dependencies, reports and generated builds are excluded.
--merge incorporates remote edits locally; publishing the rebuilt release completes
the sync. --record saves a baseline only when remote and local sources match.
"""
import argparse
import os
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shlex
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = ['client', 'server', 'shared', 'data', 'public', 'assets-src',
                'scripts', 'tests', 'docs', 'deployment', 'index.html',
                'package.json', 'package-lock.json', 'tsconfig.json',
                'vite.config.ts', 'playwright.config.ts', 'README.md', 'AGENTS.md',
                '.env.example', '.gitignore', 'LICENSE', '启动校园.command',
                'references/manifest.json']
BASE = ROOT / '.sync-base/source.tar.gz'

def allowed(name):
    p = PurePosixPath(name)
    return (not p.is_absolute() and '..' not in p.parts
            and any(name == r or name.startswith(r + '/') for r in SOURCE_ROOTS)
            and name != 'deployment/release.json'
            and '__pycache__' not in p.parts
            and not name.endswith(('.sqlite', '.sqlite-wal', '.sqlite-shm', '.pyc')))

def archive_files(data):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
        for member in archive.getmembers():
            name = str(PurePosixPath(member.name))
            if allowed(name) and member.isfile():
                files[name] = archive.extractfile(member).read()
    return files

def local_files():
    files = {}
    for entry in SOURCE_ROOTS:
        root = ROOT / entry
        for path in ([root] if root.is_file() else root.rglob('*')):
            if path.is_symlink():
                raise RuntimeError('Source symlink must be reviewed: ' + str(path))
            if path.is_file() and allowed(path.relative_to(ROOT).as_posix()):
                files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    return files

def reconcile(local, remote, base):
    """Return a complete plan; never apply a partial plan with conflicts."""
    plan, conflicts = {}, []
    for name in sorted(local.keys() | remote.keys() | base.keys()):
        left, right, ancestor = local.get(name), remote.get(name), base.get(name)
        if left == right or right == ancestor:
            continue
        if left == ancestor:
            plan[name] = right
            continue
        if None in (left, right, ancestor) or any(b'\0' in x for x in (left, right, ancestor)):
            conflicts.append(name)
            continue
        with tempfile.TemporaryDirectory(prefix='westlake-merge-') as tmp:
            paths = [Path(tmp) / n for n in ('local', 'base', 'remote')]
            for path, value in zip(paths, (left, ancestor, right)):
                path.write_bytes(value)
            result = subprocess.run(['git', 'merge-file', '-p', *map(str, paths)], capture_output=True)
            if result.returncode:
                conflicts.append(name)
            else:
                plan[name] = result.stdout
    return plan, conflicts

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--merge', action='store_true')
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--host', default=os.environ.get('CAMPUS_SSH_HOST'), required=not os.environ.get('CAMPUS_SSH_HOST'))
    parser.add_argument('--remote-root', default=os.environ.get('CAMPUS_REMOTE_ROOT'), required=not os.environ.get('CAMPUS_REMOTE_ROOT'))
    args = parser.parse_args()
    if args.merge and args.record:
        parser.error('--merge and --record are separate steps')
    remote_code = '''import io,json,os,sys,tarfile
os.chdir(sys.argv[1])
with tarfile.open(fileobj=sys.stdout.buffer,mode="w|gz") as archive:
 for path in json.loads(sys.argv[2]):
  if os.path.exists(path): archive.add(path)
'''
    command = 'python3 -c ' + shlex.quote(remote_code) + ' ' + shlex.quote(args.remote_root) + ' ' + shlex.quote(json.dumps(SOURCE_ROOTS))
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']
    control = Path('/tmp/westlake-server-control')
    if control.exists():
        ssh += ['-S', str(control), '-o', 'UserKnownHostsFile=/tmp/westlake-deploy-known-hosts']
    data = subprocess.check_output([*ssh, args.host, command], timeout=30)
    local, remote = local_files(), archive_files(data)
    if args.record:
        differences = sorted(n for n in local.keys() | remote.keys() if local.get(n) != remote.get(n))
        if differences:
            raise RuntimeError('Cannot record unmatched deployment: ' + ', '.join(differences))
        BASE.parent.mkdir(exist_ok=True)
        BASE.write_bytes(data)
        print('Verified matching source baseline saved:', BASE)
        return
    if not BASE.exists():
        raise RuntimeError('Missing baseline. Restore the last verified release archive before merging.')
    base = archive_files(BASE.read_bytes())
    remote_changes = sorted(n for n in remote.keys() | base.keys() if remote.get(n) != base.get(n))
    local_changes = sorted(n for n in local.keys() | base.keys() if local.get(n) != base.get(n))
    plan, conflicts = reconcile(local, remote, base)
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'host': args.host,
              'status': 'CONFLICT' if conflicts else 'READY', 'remoteChanges': remote_changes,
              'localChanges': local_changes, 'localMergePlan': sorted(plan), 'conflicts': conflicts,
              'remoteHashes': {n: hashlib.sha256(v).hexdigest() for n, v in remote.items()}}
    (ROOT / 'reports/source-sync-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'remoteHashes'}, ensure_ascii=False, indent=2))
    if conflicts:
        raise RuntimeError('Resolve these overlapping edits before deployment: ' + ', '.join(conflicts))
    if args.merge:
        for name, value in plan.items():
            target = ROOT / name
            if not target.resolve().is_relative_to(ROOT):
                raise RuntimeError('Unsafe source path: ' + name)
            if value is None:
                target.unlink(missing_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(value)
        print('Remote edits incorporated locally. Build/test, publish, then run --record.')

if __name__ == '__main__':
    main()
