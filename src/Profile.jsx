import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function Profile() {
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [fiveC, setFiveC] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);

  const [cBalance, setCBalance] = useState(0);
  const [blueHearts, setBlueHearts] = useState(0);
  const [diamonds, setDiamonds] = useState(0);

  const [message, setMessage] = useState("");

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "display_name, date_of_birth, gender, fiveC, bio, tags, c_balance, blue_hearts, diamonds"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    if (profile) {
      setDisplayName(profile.display_name || "");
      setDateOfBirth(profile.date_of_birth || "");
      setGender(profile.gender || "");
      setFiveC(profile.fiveC || "");
      setBio(profile.bio || "");
      setTags(profile.tags || []);

      setCBalance(profile.c_balance ?? 0);
      setBlueHearts(profile.blue_hearts ?? 0);
      setDiamonds(profile.diamonds ?? 0);
    }

    const { data: photoData, error: photoError } =
      await supabase
        .from("profile_photos")
        .select("id, photo_url, position")
        .eq("user_id", user.id)
        .order("position", { ascending: true });

    if (photoError) {
      setMessage(photoError.message);
      return;
    }

    setExistingPhotos(photoData || []);
    setMessage("");
  }

  async function handleSave(event) {
    event.preventDefault();

    setMessage("Saving profile...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { error: profileError } =
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: displayName,
          date_of_birth: dateOfBirth,
          gender: gender,
          fiveC: fiveC,
          bio: bio,
          tags: tags,
        });

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const fileExtension = photo.name.split(".").pop();

      const filePath = `${user.id}/profile-${Date.now()}-${i}.${fileExtension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("profile-photos")
          .upload(filePath, photo);

      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      const { error: photoInsertError } =
        await supabase
          .from("profile_photos")
          .insert({
            user_id: user.id,
            photo_url: data.publicUrl,
            position: existingPhotos.length + i,
          });

      if (photoInsertError) {
        setMessage(photoInsertError.message);
        return;
      }
    }

    setPhotos([]);
    setMessage("Profile saved!");

    loadProfile();
  }

  async function deletePhoto(photo) {
    const { error } = await supabase
      .from("profile_photos")
      .delete()
      .eq("id", photo.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await normalizePositions();

    setMessage("Photo deleted.");
    loadProfile();
  }

  async function movePhoto(index, direction) {
    const newIndex = index + direction;

    if (
      newIndex < 0 ||
      newIndex >= existingPhotos.length
    ) {
      return;
    }

    const currentPhoto = existingPhotos[index];
    const otherPhoto = existingPhotos[newIndex];

    const { error: firstError } =
      await supabase
        .from("profile_photos")
        .update({ position: -1 })
        .eq("id", currentPhoto.id);

    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const { error: secondError } =
      await supabase
        .from("profile_photos")
        .update({
          position: currentPhoto.position,
        })
        .eq("id", otherPhoto.id);

    if (secondError) {
      setMessage(secondError.message);
      return;
    }

    const { error: thirdError } =
      await supabase
        .from("profile_photos")
        .update({
          position: otherPhoto.position,
        })
        .eq("id", currentPhoto.id);

    if (thirdError) {
      setMessage(thirdError.message);
      return;
    }

    setMessage("Photo order updated.");
    loadProfile();
  }

  async function normalizePositions() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const {
      data: photosData,
      error,
    } = await supabase
      .from("profile_photos")
      .select("id")
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (error) {
      return;
    }

    for (let i = 0; i < photosData.length; i++) {
      await supabase
        .from("profile_photos")
        .update({ position: i })
        .eq("id", photosData[i].id);
    }
  }

  const profileComplete =
    displayName &&
    dateOfBirth &&
    gender &&
    fiveC &&
    bio;

  return (
    <div className="profile-page">

      {/* Dark mode button */}
      <button
        type="button"
        className="theme-toggle"
        onClick={() =>
          setDarkMode((current) => !current)
        }
        aria-label={
          darkMode
            ? "Switch to light mode"
            : "Switch to dark mode"
        }
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <div className="profile-form-container">

        <div className="profile-header">
          <h2>Your Profile</h2>

          <div className="profile-status-container">
            <span
              className={
                profileComplete
                  ? "profile-status complete"
                  : "profile-status incomplete"
              }
            >
              {profileComplete
                ? "Profile Complete"
                : "Profile Incomplete"}
            </span>

            <button
              type="submit"
              form="profile-form"
              className="save-profile-button"
            >
              Save Profile
            </button>
          </div>
        </div>


        {/* ========================= */}
        {/* CURRENCIES */}
        {/* ========================= */}

        <div
          style={{
            marginBottom: "25px",
            padding: "18px",
            borderRadius: "16px",
            background: darkMode
              ? "#252525"
              : "#f7f7f7",
            border: darkMode
              ? "1px solid #3a3a3a"
              : "1px solid #e5e5e5",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            
          </h3>

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                }}
              >
                {cBalance}
              </div>

              <div>C</div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                }}
              >
                💙 {blueHearts}
              </div>

              <div>Gifts</div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                }}
              >
                💎 {diamonds}
              </div>

              <div>Rare Gifts</div>
            </div>
          </div>
        </div>


        <form
          id="profile-form"
          onSubmit={handleSave}
        >
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(event) =>
              setDisplayName(event.target.value)
            }
            required
          />

          <label>
            Date of birth
            <input
              type="date"
              value={dateOfBirth}
              onChange={(event) =>
                setDateOfBirth(event.target.value)
              }
              required
            />
          </label>

          <select
            value={gender}
            onChange={(event) =>
              setGender(event.target.value)
            }
            required
          >
            <option value="">
              Select gender
            </option>

            <option value="man">
              Man
            </option>

            <option value="woman">
              Woman
            </option>

            <option value="nonbinary">
              Non-binary
            </option>

            <option value="other">
              Other
            </option>
          </select>

          <select
            value={fiveC}
            onChange={(event) =>
              setFiveC(event.target.value)
            }
            required
          >
            <option value="">
              Select 5C
            </option>

            <option value="Pomona">
              Pomona
            </option>

            <option value="Pitzer">
              Pitzer
            </option>

            <option value="Scripps">
              Scripps
            </option>

            <option value="Harvey Mudd">
              Harvey Mudd
            </option>

            <option value="CMC">
              CMC
            </option>
          </select>

          <textarea
            placeholder="Tell people about yourself..."
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
          />

          <h3>
            What are you looking for?
          </h3>

          <div>
            {[
              "Short-term",
              "Long-term",
              "Friends",
              "Hangouts",
              "Hookups",
              "Food",
              "freaky",
              "Games"
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (tags.includes(tag)) {
                    setTags(
                      tags.filter(
                        (currentTag) =>
                          currentTag !== tag
                      )
                    );
                  } else {
                    setTags([
                      ...tags,
                      tag,
                    ]);
                  }
                }}
                className={
                  tags.includes(tag)
                    ? "profile-tag-button selected"
                    : "profile-tag-button"
                }
              >
                {tag}
              </button>
            ))}
          </div>

          <label>
            Add profile photos

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setPhotos(
                  Array.from(
                    event.target.files
                  )
                )
              }
            />
          </label>

          {photos.length > 0 && (
            <p>
              {photos.length} new photo
              {photos.length === 1
                ? ""
                : "s"} selected
            </p>
          )}

          <h3>Your Photos</h3>

          <div className="existing-photos">
            {existingPhotos.map(
              (photo, index) => (
                <div
                  key={photo.id}
                  className="existing-photo"
                >
                  <img
                    src={photo.photo_url}
                    alt="Profile"
                    width="150"
                  />

                  {index === 0 && (
                    <p>
                      <strong>
                        Primary Photo
                        (the first thing
                        people will see)
                      </strong>
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      movePhoto(index, -1)
                    }
                    disabled={index === 0}
                  >
                    Move Up
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      movePhoto(index, 1)
                    }
                    disabled={
                      index ===
                      existingPhotos.length - 1
                    }
                  >
                    Move Down
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deletePhoto(photo)
                    }
                  >
                    Delete
                  </button>

                  <hr />
                </div>
              )
            )}
          </div>
        </form>

        <p>{message}</p>
      </div>
    </div>
  );
}

export default Profile;