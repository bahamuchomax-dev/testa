import { useEffect, useRef, useState } from "react";
import { currentUid } from "../../services/firebase/client.js";
import * as profiles from "../../services/repository/profileRepository.js";
import {
  compressAvatarToBlob,
  saveAvatarBlob,
  loadAvatarBlob,
  deleteAvatarBlob,
} from "../../services/avatarStorage.js";

/* ============================================================
 * Profile — profile screen scaffold
 * ------------------------------------------------------------
 * AVATAR storage (bug-fix phase 3):
 *   - The image is stored as a Blob in IndexedDB (services/avatarStorage.js),
 *     mirroring the theme-photo helper. It is NEVER turned into a base64 /
 *     data URL, NEVER written to localStorage, and NEVER placed in the profile
 *     save payload. localStorage keeps only name/bio (no image).
 *   - Preview uses a Blob URL (URL.createObjectURL) that is revoked on change
 *     and on unmount. On mount we restore the avatar from IndexedDB.
 *   - role / isTeacher are NEVER written from here (Firestore-Rules territory).
 *
 * STATUS: documented migration target. Reuses .rx-mp / .rx-pcard / .rx-avatar
 * / .rx-stats / .rx-bigedit. See MIGRATION.md.
 * ============================================================ */

const MAX_BYTES = 5 * 1024 * 1024;

export default function Profile({ uid = currentUid(), stats = [], onBack }) {
  // Only name/bio live in the profile record. The avatar image never does.
  const [profile, setProfile] = useState(() => {
    const p = profiles.get(uid);
    return { name: p.name || "", bio: p.bio || "" };
  });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const urlRef = useRef(null);

  const update = (patch) => setProfile((p) => ({ ...p, ...patch }));

  // Swap the preview Blob URL, revoking the previous one to avoid leaks.
  const setAvatarPreview = (blobOrNull) => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (blobOrNull) {
      const u = URL.createObjectURL(blobOrNull);
      urlRef.current = u;
      setAvatarUrl(u);
    } else {
      setAvatarUrl(null);
    }
  };

  // Restore the avatar from IndexedDB on mount / uid change.
  useEffect(() => {
    let alive = true;
    loadAvatarBlob({ uid }).then((blob) => {
      if (alive && blob) setAvatarPreview(blob);
    });
    return () => {
      alive = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [uid]);

  const onPickAvatar = async (e) => {
    setError("");
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("画像ファイルを選択してください。");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("画像が大きすぎます（5MBまで）。");
      }
      const { blob } = await compressAvatarToBlob(file);
      await saveAvatarBlob(blob, { uid });
      setAvatarPreview(blob); // 即プレビュー反映
    } catch (err) {
      setError((err && err.message) || "画像の処理に失敗しました。");
    } finally {
      // value を空にして「同じ画像の再選択」を可能にする
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemoveAvatar = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setError("");
    try {
      await deleteAvatarBlob({ uid });
    } catch {
      /* 削除失敗時もUIは進める */
    }
    setAvatarPreview(null);
  };

  const save = () => {
    setError("");
    setSaved(false);
    // 画像本体は IndexedDB。保存 payload には name/bio だけ（avatar base64 は入れない）。
    const res = profiles.save(uid, { name: profile.name, bio: profile.bio });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
  };

  return (
    <div className="rx-mp">
      {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}

      <div className="rx-pcard">
        <div
          className="rx-avatar"
          onClick={() => fileRef.current && fileRef.current.click()}
          role="button"
          aria-label="アバター画像を選択"
        >
          {avatarUrl ? <img src={avatarUrl} alt="プロフィール画像" /> : "＋"}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
        {avatarUrl && (
          <button type="button" className="rx-mini-danger" onClick={onRemoveAvatar}>
            アバターを削除
          </button>
        )}
        <div className="rx-pname">{profile.name || "名前未設定"}</div>
        <div className="rx-pid">ID: {uid}</div>

        {stats.length > 0 && (
          <div className="rx-stats">
            {stats.map((s) => (
              <div className="rx-stat" key={s.label}>
                <div className="v">{s.value}</div>
                <div className="l">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        className="rx-tf"
        style={{ marginTop: 16 }}
        placeholder="名前"
        value={profile.name || ""}
        onChange={(e) => update({ name: e.target.value })}
      />
      <textarea
        className="rx-tf"
        style={{ marginTop: 8, minHeight: 90 }}
        placeholder="自己紹介"
        value={profile.bio || ""}
        onChange={(e) => update({ bio: e.target.value })}
      />

      {error && <div className="rx-support-msg" role="alert" style={{ color: "#d4574e" }}>{error}</div>}
      {saved && !error && <div className="rx-support-msg">保存しました。</div>}

      <button className="rx-bigedit" style={{ marginTop: 12 }} onClick={save}>保存</button>
    </div>
  );
}
