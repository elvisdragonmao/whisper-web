import json
import sys

from worker import JobCancelled, WhisperRunner


def main():
    """
    argv:
      1: src_path
      2: job_id
      3: uploads_dir
      4: outputs_dir
      5: traditional (0/1)
    GPU 由 parent process 用 CUDA_VISIBLE_DEVICES 控制。
    """
    src_path = sys.argv[1]
    job_id = sys.argv[2]
    uploads_dir = sys.argv[3]
    outputs_dir = sys.argv[4]
    traditional = bool(int(sys.argv[5]))

    runner = WhisperRunner()

    def on_event(msg):
        print(json.dumps(msg, ensure_ascii=False), flush=True)

    def is_cancelled():
        # subprocess 版的取消靠 parent 發 SIGTERM/SIGKILL,
        # 不靠 shared flag, 所以這裡永遠 False。
        return False

    try:
        stats = runner.run(
            src_path=src_path,
            job_id=job_id,
            to_traditional=traditional,
            uploads_dir=uploads_dir,
            outputs_dir=outputs_dir,
            on_event=on_event,
            is_cancelled=is_cancelled,
        )
        print(json.dumps({"type": "done", "stats": stats}, ensure_ascii=False), flush=True)
    except JobCancelled:
        print(json.dumps({"type": "paused"}, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
