#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体子集化构建脚本（考试看板）
=====================================================
作用：把「原始完整字体」按统一字符集（scripts/font-charset.txt）重新子集化，
输出体积更小的 woff2（默认）或 woff，放到 public/fonts/。

依赖：
  pip install fonttools brotli    # brotli 仅 woff2 需要

用法：
  1) 把原始字体放到 fonts-src/（按下方 FACES 里的 src 名，或自行修改映射）
  2) python3 scripts/build-fonts.py            # 出 woff2
     python3 scripts/build-fonts.py --woff     # 出 woff（无 brotli 时用）
     python3 scripts/build-fonts.py --both
加字时：编辑 scripts/font-charset.txt 后重跑本脚本即可。
"""
import os, sys, subprocess, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'fonts-src')          # 放原始字体
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')    # 输出目录
CHARSET = os.path.join(ROOT, 'scripts', 'font-charset.txt')

# src = fonts-src/ 下的原始文件名；out = public/fonts/ 下的输出名（不带后缀）
FACES = [
    # 阿里巴巴普惠体（三字重）
    {'src': 'AlibabaPuHuiTi-3-55-Regular.ttf',   'out': 'alibaba-puhuiti-regular-subset'},
    {'src': 'AlibabaPuHuiTi-3-75-SemiBold.ttf',  'out': 'alibaba-puhuiti-semibold-subset'},
    {'src': 'AlibabaPuHuiTi-3-95-ExtraBold.ttf', 'out': 'alibaba-puhuiti-extrabold-subset'},
    # 思源黑体 SC（正文 + heavy）
    {'src': 'SourceHanSansSC-Normal.otf',        'out': 'source-han-sc-standard-subset'},
    {'src': 'SourceHanSansSC-Heavy.otf',         'out': 'source-han-sc-heavy-subset'},
    # 霞鹭文楷 SC
    {'src': 'LXGWWenKai-Regular.ttf',            'out': 'lxgw-wenkai-sc-standard-subset'},
    # Smiley Sans（如需重切；不需则删掉这行）
    {'src': 'SmileySans-Oblique.ttf',            'out': 'smiley-sans-display-subset'},
]

# pyftsubset 公共参数（体积优先）
BASE_ARGS = [
    '--text-file=' + CHARSET,
    '--layout-features=kern,liga,calt,ccmp,locl,mark,mkmk',
    '--no-hinting',
    '--desubroutinize',
    '--drop-tables+=DSIG',
    '--name-IDs=1,2,3,4,6',
    '--recalc-bounds',
    '--recalc-average-width',
]


def human(n):
    for u in ('B', 'KB', 'MB'):
        if n < 1024:
            return f'{n:.0f}{u}'
        n /= 1024
    return f'{n:.1f}GB'


def have_brotli():
    try:
        import brotli  # noqa
        return True
    except Exception:
        return False


def build(face, flavor):
    src = os.path.join(SRC_DIR, face['src'])
    if not os.path.exists(src):
        print(f"  [SKIP] 缺少原始文件: fonts-src/{face['src']}")
        return
    ext = 'woff2' if flavor == 'woff2' else 'woff'
    out = os.path.join(OUT_DIR, face['out'] + '.' + ext)
    args = ['pyftsubset', src, *BASE_ARGS, f'--flavor={flavor}', f'--output-file={out}']
    subprocess.run(args, check=True)
    print(f"  [OK] {face['src']}  ->  {os.path.relpath(out, ROOT)}  "
          f"({human(os.path.getsize(src))} -> {human(os.path.getsize(out))})")


def main():
    mode = 'woff2'
    if '--woff' in sys.argv:
        mode = 'woff'
    elif '--both' in sys.argv:
        mode = 'both'
    if not shutil.which('pyftsubset'):
        sys.exit('请先安装 fonttools: pip install fonttools brotli')
    if not os.path.exists(CHARSET):
        sys.exit('缺少字符集文件 scripts/font-charset.txt')
    with open(CHARSET, encoding='utf-8') as f:
        n = len(set(f.read()))
    print(f'字符集共 {n} 个字符；输出格式 = {mode}\n')
    flavors = ['woff2', 'woff'] if mode == 'both' else [mode]
    if 'woff2' in flavors and not have_brotli():
        sys.exit('woff2 需要 brotli：pip install brotli（或使用 --woff）')
    os.makedirs(OUT_DIR, exist_ok=True)
    for flavor in flavors:
        print(f'== 输出 {flavor} ==')
        for face in FACES:
            build(face, flavor)
    print('\n完成。')


if __name__ == '__main__':
    main()
