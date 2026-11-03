#!/usr/bin/env python3
"""把 render.js 渲好的各景用 xfade 轉場串成一支片，可選配樂。

  python3 assemble.py intro/storyboard.json --out work/agent-office-intro.mp4 [--music bgm.mp3] [--loudness -18]

--music 傳 default 時，用 intro-video 技能附的預設背景音樂（環境變數 INTRO_VIDEO_SKILL 指向技能資料夾）。
音樂比片短會交叉淡接循環，頭 1 秒淡入、尾 3 秒淡出，再 loudnorm 到 --loudness（預設 -18 LUFS）。
"""
import argparse, json, os, subprocess, sys, tempfile
from pathlib import Path

P = Path(__file__).resolve().parent


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'ffmpeg 失敗：{r.stderr[-800:]}')
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('storyboard', type=Path)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--music')
    ap.add_argument('--loudness', type=float, default=-18)
    ap.add_argument('--crf', type=int, default=18)
    a = ap.parse_args()
    sb = json.loads(a.storyboard.read_text(encoding='utf-8'))
    sc, xf, fps = sb['scenes'], float(sb.get('xfade', .6)), int(sb.get('fps', 30))
    work = P / 'work' / a.storyboard.resolve().parent.name
    ins, fg, prev, t = [], [], '[0:v]', 0.0
    for i, s in enumerate(sc):
        ins += ['-i', str(work / (Path(s['file']).stem + '.mp4'))]
        if i:
            t += sc[i - 1]['duration'] - xf
            fg.append(f"{prev}[{i}:v]xfade=transition={sc[i - 1].get('transition', 'fade')}:duration={xf}:offset={t:.3f}[v{i}]")
            prev = f'[v{i}]'
    total = t + sc[-1]['duration']
    fg.append(f'{prev}format=yuv420p[vout]')
    a.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        vid = Path(td) / 'v.mp4'
        run(['ffmpeg', '-y', '-loglevel', 'error', *ins, '-filter_complex', ';'.join(fg), '-map', '[vout]',
             '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-r', str(fps), '-pix_fmt', 'yuv420p', str(vid)])
        if not a.music:
            run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(vid), '-c', 'copy', '-movflags', '+faststart', str(a.out)])
            print(f'[done] {a.out}（無聲，{total:.1f} 秒）')
            return
        music = Path(a.music)
        if a.music == 'default':
            skill = Path(os.environ.get('INTRO_VIDEO_SKILL', '~/.claude/skills/intro-video')).expanduser()
            music = next(iter(sorted((skill / 'assets' / 'audio').glob('*.mp3'))), None)
            if not music:
                sys.exit('找不到預設背景音樂：請設 INTRO_VIDEO_SKILL 指向 intro-video 技能資料夾，或用 --music 指定檔案')
        md = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(music)]).stdout)
        n, cf = 1, 1.5
        while n * md - (n - 1) * cf < total + .5:
            n += 1
        mi, mf, mp = [], [], '[0:a]'
        for i in range(n):
            mi += ['-i', str(music)]
            if i:
                mf.append(f'{mp}[{i}:a]acrossfade=d={cf}:c1=tri:c2=tri[m{i}]')
                mp = f'[m{i}]'
        mf.append(f'{mp}atrim=0:{total:.3f},afade=t=in:d=1,afade=t=out:st={total - 3:.3f}:d=3,loudnorm=I={a.loudness}:TP=-1.5:LRA=11[aout]')
        aud = Path(td) / 'a.m4a'
        run(['ffmpeg', '-y', '-loglevel', 'error', *mi, '-filter_complex', ';'.join(mf), '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', str(aud)])
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(vid), '-i', str(aud), '-map', '0:v', '-map', '1:a', '-c', 'copy',
             '-shortest', '-movflags', '+faststart', str(a.out)])
        print(f'[done] {a.out}（配樂 {music.name}，{total:.1f} 秒，{a.loudness} LUFS）')


if __name__ == '__main__':
    main()
