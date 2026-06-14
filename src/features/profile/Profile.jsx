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
 * Profile - React migration phase 1 scaffold
 * ------------------------------------------------------------
 * This screen is prepared for the first small React migration target, but it
 * is still not mounted by the production entry. src/main.js continues to boot
 * the legacy bundle.
 *
 * Safety rules:
 *   - name/bio are saved only through profileRepository.save(), which applies
 *     sanitizePlainText and clamps lengths.
 *   - avatar image bytes are stored as IndexedDB Blob data via
 *     services/avatarStorage.js. Never store avatar base64/data URLs in
 *     localStorage or in the profile save payload.
 *   - preview URLs are object URLs and must be revoked on replacement/unmount.
 *   - role / isTeacher fields are never written from this screen.
 * ============================================================ */

export const PROFILE_NAME_MAX_LENGTH = 120;
export const PROFILE_BIO_MAX_LENGTH = 4000;
const MAX_BYTES = 5 * 1024 * 1024;

function loadProfile(uid) {
  const p = profiles.get(uid);
  return { name: p.name || "", bio: p.bio || "" };
}

export default function Profile({ uid = currentUid(), stats = [], onBack }) {
  const profileUid = uid || "";
  const [profile, setProfile] = useState(() => loadProfile(profileUid || currentUid()));
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const urlRef = useRef(null);

  const update = (patch) => {
    setSaved(false);
    setProfile((p) => ({ ...p, ...patch }));
  };

  const revokeAvatarPreview = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const setAvatarPreview = (blobOrNull) => {
    revokeAvatarPreview();
    if (blobOrNull) {
      const nextUrl = URL.createObjectURL(blobOrNull);
      urlRef.current = nextUrl;
      setAvatarUrl(nextUrl);
    } else {
      setAvatarUrl(null);
    }
  };

  useEffect(() => {
    setProfile(loadProfile(profileUid || currentUid()));
    setSaved(false);
    setError("");
  }, [profileUid]);

  useEffect(() => {
    let alive = true;
    if (!profileUid) {
      setAvatarPreview(null);
      return () => {
        alive = false;
        revokeAvatarPreview();
      };
    }

    loadAvatarBlob({ uid: profileUid }).then((blob) => {
      if (alive) setAvatarPreview(blob || null);
    });

    return () => {
      alive = false;
      revokeAvatarPreview();
    };
  }, [profileUid]);

  const onPickAvatar = async (e) => {
    setError("");
    setSaved(false);
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      if (!profileUid) throw new Error("ログイン状態を確認してから保存してください。");
      if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("画像ファイルを選択してください。");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("画像が大きすぎます。5MBまでの画像を選択してください。");
      }

      const { blob } = await compressAvatarToBlob(file);
      await saveAvatarBlob(blob, { uid: profileUid });
      setAvatarPreview(blob);
    } catch (err) {
      setError((err && err.message) || "アバター画像の処理に失敗しました。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemoveAvatar = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setError("");
    setSaved(false);
    if (!profileUid) {
      setError("ログイン状態を確認してから削除してください。");
      return;
    }

    try {
      await deleteAvatarBlob({ uid: profileUid });
    } catch {
      /* Deletion failure is non-fatal for this local preview. */
    }
    setAvatarPreview(null);
  };

  const save = () => {
    setError("");
    setSaved(false);
    if (!profileUid) {
      setError("ログイン状態を確認してから保存してください。");
      return;
    }

    // The image itself stays in IndexedDB. The profile payload is text only.
    const res = profiles.save(profileUid, { name: profile.name, bio: profile.bio });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProfile({ name: res.profile.name || "", bio: res.profile.bio || "" });
    setSaved(true);
  };

  return (
    <div className="rx-mp">
      {onBack && <button className="rx-back" onClick={onBack}>戻る</button>}

      <div className="rx-pcard">
        <div
          className="rx-avatar"
          onClick={() => fileRef.current && fileRef.current.click()}
          role="button"
          tabIndex={0}
          aria-label="アバター画像を選択"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (fileRef.current) fileRef.current.click();
            }
          }}
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
        {profile.bio && (
          <div className="rx-pbio" style={{ whiteSpace: "pre-wrap" }}>
            {profile.bio}
          </div>
        )}
        <div className="rx-pid">ID: {profileUid || "未ログイン"}</div>

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
        maxLength={PROFILE_NAME_MAX_LENGTH}
        value={profile.name || ""}
        onChange={(e) => update({ name: e.target.value })}
      />
      <textarea
        className="rx-tf"
        style={{ marginTop: 8, minHeight: 90, whiteSpace: "pre-wrap" }}
        placeholder="自己紹介"
        maxLength={PROFILE_BIO_MAX_LENGTH}
        value={profile.bio || ""}
        onChange={(e) => update({ bio: e.target.value })}
      />

      {error && <div className="rx-support-msg" role="alert" style={{ color: "#d4574e" }}>{error}</div>}
      {saved && !error && <div className="rx-support-msg">保存しました。</div>}

      <button className="rx-bigedit" style={{ marginTop: 12 }} onClick={save}>
        保存
      </button>
    </div>
  );
}
