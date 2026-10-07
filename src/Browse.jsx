import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./Browse.css";

function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function Browse() {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState("Loading profiles...");

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Filter panel
  const [showFilters, setShowFilters] = useState(false);

  // Selected filters
  const [selectedGenders, setSelectedGenders] = useState([
    "man",
    "woman",
    "nonbinary",
    "other",
  ]);

  const [selectedAges, setSelectedAges] = useState([
    "18-19",
    "19-20",
    "20-21",
    "21-22",
    "23+",
  ]);

  const [selectedColleges, setSelectedColleges] = useState([
    "Pomona",
    "Pitzer",
    "Scripps",
    "Harvey Mudd",
    "CMC",
  ]);

  const [selectedTags, setSelectedTags] = useState([
    "Short-term",
    "Long-term",
    "Casual",
    "Friends",
    "Not sure",
  ]);

  // Swipe animation
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);

  useEffect(() => {
    loadProfiles();
  }, []);
  async function randomChat() {
    setMessage("Finding someone to chat with...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { data: matchId, error } =
      await supabase.rpc(
        "find_random_chat"
      );

    if (error) {
      setMessage(
        error.message
          .replace("Error: ", "")
      );
      return;
    }

    if (!matchId) {
      setMessage(
        "No random users are available right now."
      );
      return;
    }

    // Go directly to the new chat.
    window.location.href =
      `/chat/${matchId}`;
  }
  async function loadProfiles() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    // Get everyone this user has blocked.
    const { data: blocks, error: blockError } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);

    if (blockError) {
      setMessage(blockError.message);
      return;
    }

    const blockedUserIds = (blocks || []).map(
      (block) => block.blocked_id
    );

    // Load profiles, excluding the current user.
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, date_of_birth, fiveC, gender, bio, tags"
      )
      .neq("id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    // Remove anyone this user has blocked.
    const unblockedProfiles = data.filter(
      (profile) => !blockedUserIds.includes(profile.id)
    );

    const profileIds = unblockedProfiles.map(
      (profile) => profile.id
    );

    let photoData = [];

    if (profileIds.length > 0) {
      const { data: photos, error: photoError } = await supabase
        .from("profile_photos")
        .select("id, user_id, photo_url, position")
        .in("user_id", profileIds)
        .order("position", { ascending: true });

      if (photoError) {
        setMessage(photoError.message);
        return;
      }

      photoData = photos || [];
    }

    const profilesWithPhotos = unblockedProfiles.map((profile) => ({
      ...profile,
      photos: photoData.filter(
        (photo) => photo.user_id === profile.id
      ),
    }));

    setProfiles(profilesWithPhotos);
    setCurrentIndex(0);
    setCurrentPhotoIndex(0);
    setMessage("");
  }

  /*
    Apply the selected filters to all profiles.

    Within each category:
    - Any selected option is allowed.

    Between categories:
    - A profile must satisfy ALL categories.
  */
  const filteredProfiles = profiles.filter((profile) => {
    // --------------------------------
    // GENDER FILTER
    // --------------------------------

    if (selectedGenders.length < 4) {
      if (!selectedGenders.includes(profile.gender)) {
        return false;
      }
    }

    // --------------------------------
    // COLLEGE FILTER
    // --------------------------------

    if (selectedColleges.length < 5) {
      if (!selectedColleges.includes(profile.fiveC)) {
        return false;
      }
    }

    // --------------------------------
    // TAG FILTER
    // --------------------------------

    if (selectedTags.length < 5) {
      if (selectedTags.length === 0) {
        return false;
      }

      const profileTags = profile.tags || [];

      const hasMatchingTag = profileTags.some((tag) =>
        selectedTags.includes(tag)
      );

      if (!hasMatchingTag) {
        return false;
      }
    }

    // --------------------------------
    // AGE FILTER
    // --------------------------------

    if (selectedAges.length < 5) {
      if (selectedAges.length === 0) {
        return false;
      }

      const age = calculateAge(profile.date_of_birth);

      let ageMatches = false;

      if (
        selectedAges.includes("18-19") &&
        age >= 18 &&
        age <= 19
      ) {
        ageMatches = true;
      }

      if (
        selectedAges.includes("19-20") &&
        age >= 19 &&
        age <= 20
      ) {
        ageMatches = true;
      }

      if (
        selectedAges.includes("20-21") &&
        age >= 20 &&
        age <= 21
      ) {
        ageMatches = true;
      }

      if (
        selectedAges.includes("21-22") &&
        age >= 21 &&
        age <= 22
      ) {
        ageMatches = true;
      }

      if (
        selectedAges.includes("23+") &&
        age >= 23
      ) {
        ageMatches = true;
      }

      if (!ageMatches) {
        return false;
      }
    }

    return true;
  });

  // --------------------------------
  // BLOCK PROFILE
  // --------------------------------

  async function blockProfile(profile) {
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to block ${profile.display_name}?`
    );

    if (!confirmed) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { error } = await supabase
      .from("blocks")
      .insert({
        blocker_id: user.id,
        blocked_id: profile.id,
      });

    if (error) {
      if (error.message.includes("duplicate")) {
        setMessage("You already blocked this person.");
      } else {
        setMessage(error.message);
      }

      return;
    }

    // Remove the blocked person from the current Browse list.
    setProfiles((currentProfiles) =>
      currentProfiles.filter(
        (currentProfile) => currentProfile.id !== profile.id
      )
    );

    setCurrentIndex(0);
    setCurrentPhotoIndex(0);
    setDragX(0);
  }

  // --------------------------------
  // LIKE PROFILE
  // --------------------------------

  async function likeProfile(
    profile = filteredProfiles[currentIndex]
  ) {
    if (!profile) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const { error: likeError } = await supabase
      .from("likes")
      .upsert(
        {
          liker_id: user.id,
          liked_id: profile.id,
        },
        {
          onConflict: "liker_id,liked_id",
          ignoreDuplicates: true,
        }
      );

    if (likeError) {
      setMessage(likeError.message);
      return;
    }

    const {
      data: mutualLike,
      error: checkError,
    } = await supabase
      .from("likes")
      .select("id")
      .eq("liker_id", profile.id)
      .eq("liked_id", user.id)
      .maybeSingle();

    if (checkError) {
      setMessage(checkError.message);
      return;
    }

    if (mutualLike) {
      const { error: matchError } = await supabase
        .from("matches")
        .insert({
          user1_id: user.id,
          user2_id: profile.id,
        });

      if (matchError) {
        if (!matchError.message.includes("duplicate")) {
          setMessage(matchError.message);
          return;
        }
      } else {
        alert(`It's a match with ${profile.display_name}!`);
      }
    }

    nextProfile();
  }

  // --------------------------------
  // NEXT PROFILE
  // --------------------------------

  function nextProfile() {
    setDragX(0);
    setCurrentPhotoIndex(0);

    setCurrentIndex((index) => index + 1);
  }

  // --------------------------------
  // PHOTO NAVIGATION
  // --------------------------------

  function nextPhoto(event) {
    event.stopPropagation();

    const profile = filteredProfiles[currentIndex];

    if (!profile || profile.photos.length <= 1) {
      return;
    }

    setCurrentPhotoIndex((index) =>
      Math.min(index + 1, profile.photos.length - 1)
    );
  }

  function previousPhoto(event) {
    event.stopPropagation();

    setCurrentPhotoIndex((index) =>
      Math.max(index - 1, 0)
    );
  }

  // --------------------------------
  // SWIPING
  // --------------------------------

  function handlePointerDown(event) {
    startX.current = event.clientX;
    setIsDragging(true);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isDragging) {
      return;
    }

    const distance = event.clientX - startX.current;

    setDragX(distance);
  }

  async function handlePointerUp() {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);

    const swipeThreshold = 120;

    if (dragX > swipeThreshold) {
      setDragX(window.innerWidth + 500);

      setTimeout(async () => {
        await likeProfile();
      }, 250);

      return;
    }

    if (dragX < -swipeThreshold) {
      setDragX(-window.innerWidth - 500);

      setTimeout(() => {
        nextProfile();
      }, 250);

      return;
    }

    setDragX(0);
  }

  function swipeCard(direction) {
    if (direction === "right") {
      setDragX(window.innerWidth + 500);

      setTimeout(async () => {
        await likeProfile();
      }, 250);
    } else {
      setDragX(-window.innerWidth - 500);

      setTimeout(() => {
        nextProfile();
      }, 250);
    }
  }

  // --------------------------------
  // LOADING
  // --------------------------------

  if (message) {
    return <p>{message}</p>;
  }

  // --------------------------------
  // NO PROFILES AT ALL
  // --------------------------------

  if (profiles.length === 0) {
    return (
      <div className="browse-container">
        <h2>No profiles available yet.</h2>
      </div>
    );
  }

  // --------------------------------
  // NO PROFILES MATCH FILTERS
  // --------------------------------

  if (filteredProfiles.length === 0) {
    return (
      <div className="browse-container">
                <button
          className="random-chat-button"
          onClick={randomChat}
        >
          🎲 Chat With a Random User
        </button>
        <button
          className="filters-button"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </button>

        {showFilters && (
          <div className="filters-panel">
            <h2>Filters</h2>

            <h3>Gender</h3>

            {[
              ["man", "Man"],
              ["woman", "Woman"],
              ["nonbinary", "Non-binary"],
              ["other", "Other"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={selectedGenders.includes(value)}
                  onChange={() => {
                    setSelectedGenders(
                      selectedGenders.includes(value)
                        ? selectedGenders.filter(
                            (gender) => gender !== value
                          )
                        : [...selectedGenders, value]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {label}
              </label>
            ))}

            <h3>Age</h3>

            {[
              "18-19",
              "19-20",
              "20-21",
              "21-22",
              "23+",
            ].map((age) => (
              <label key={age}>
                <input
                  type="checkbox"
                  checked={selectedAges.includes(age)}
                  onChange={() => {
                    setSelectedAges(
                      selectedAges.includes(age)
                        ? selectedAges.filter(
                            (selectedAge) =>
                              selectedAge !== age
                          )
                        : [...selectedAges, age]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {age}
              </label>
            ))}

            <h3>College</h3>

            {[
              "Pomona",
              "Pitzer",
              "Scripps",
              "Harvey Mudd",
              "CMC",
            ].map((college) => (
              <label key={college}>
                <input
                  type="checkbox"
                  checked={selectedColleges.includes(college)}
                  onChange={() => {
                    setSelectedColleges(
                      selectedColleges.includes(college)
                        ? selectedColleges.filter(
                            (selectedCollege) =>
                              selectedCollege !== college
                          )
                        : [
                            ...selectedColleges,
                            college,
                          ]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {college}
              </label>
            ))}

            <h3>What are you looking for?</h3>

            {[
              "Short-term",
              "Long-term",
              "Casual",
              "Friends",
              "Not sure",
            ].map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => {
                    setSelectedTags(
                      selectedTags.includes(tag)
                        ? selectedTags.filter(
                            (selectedTag) =>
                              selectedTag !== tag
                          )
                        : [...selectedTags, tag]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {tag}
              </label>
            ))}
          </div>
        )}

        <h2>No profiles match your filters.</h2>

        <p>Try changing your filters.</p>
      </div>
    );
  }

  // --------------------------------
  // EVERYONE HAS BEEN SWIPED
  // --------------------------------

  if (currentIndex >= filteredProfiles.length) {
    return (
      <div className="browse-container">
                <button
          className="random-chat-button"
          onClick={randomChat}
        >
          🎲 Chat With a Random User
        </button>
        <button
          className="filters-button"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </button>

        {showFilters && (
          <div className="filters-panel">
            <h2>Filters</h2>

            <h3>Gender</h3>

            {[
              ["man", "Man"],
              ["woman", "Woman"],
              ["nonbinary", "Non-binary"],
              ["other", "Other"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={selectedGenders.includes(value)}
                  onChange={() => {
                    setSelectedGenders(
                      selectedGenders.includes(value)
                        ? selectedGenders.filter(
                            (gender) => gender !== value
                          )
                        : [...selectedGenders, value]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {label}
              </label>
            ))}

            <h3>Age</h3>

            {[
              "18-19",
              "19-20",
              "20-21",
              "21-22",
              "23+",
            ].map((age) => (
              <label key={age}>
                <input
                  type="checkbox"
                  checked={selectedAges.includes(age)}
                  onChange={() => {
                    setSelectedAges(
                      selectedAges.includes(age)
                        ? selectedAges.filter(
                            (selectedAge) =>
                              selectedAge !== age
                          )
                        : [...selectedAges, age]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {age}
              </label>
            ))}

            <h3>College</h3>

            {[
              "Pomona",
              "Pitzer",
              "Scripps",
              "Harvey Mudd",
              "CMC",
            ].map((college) => (
              <label key={college}>
                <input
                  type="checkbox"
                  checked={selectedColleges.includes(college)}
                  onChange={() => {
                    setSelectedColleges(
                      selectedColleges.includes(college)
                        ? selectedColleges.filter(
                            (selectedCollege) =>
                              selectedCollege !== college
                          )
                        : [
                            ...selectedColleges,
                            college,
                          ]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {college}
              </label>
            ))}

            <h3>What are you looking for?</h3>

            {[
              "Short-term",
              "Long-term",
              "Casual",
              "Friends",
              "Not sure",
            ].map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => {
                    setSelectedTags(
                      selectedTags.includes(tag)
                        ? selectedTags.filter(
                            (selectedTag) =>
                              selectedTag !== tag
                          )
                        : [...selectedTags, tag]
                    );

                    setCurrentIndex(0);
                  }}
                />

                {tag}
              </label>
            ))}
          </div>
        )}

        <h2>You've seen everyone!</h2>
      </div>
    );
  }

  const profile = filteredProfiles[currentIndex];

  const rotation = dragX / 15;

  let swipeClass = "";

  if (dragX > 120) {
    swipeClass = "swipe-like";
  } else if (dragX < -120) {
    swipeClass = "swipe-pass";
  }

  const currentPhoto =
    profile.photos.length > 0
      ? profile.photos[currentPhotoIndex]
      : null;

  return (
    <div className="browse-container">
            <button
        className="random-chat-button"
        onClick={randomChat}
      >
        🎲 Chat With a Random User
      </button>
      <button
        className="filters-button"
        onClick={() => setShowFilters(!showFilters)}
      >
        Filters
      </button>

      {showFilters && (
        <div className="filters-panel">
          <h2>Filters</h2>

          <h3>Gender</h3>

          {[
            ["man", "Man"],
            ["woman", "Woman"],
            ["nonbinary", "Non-binary"],
            ["other", "Other"],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={selectedGenders.includes(value)}
                onChange={() => {
                  setSelectedGenders(
                    selectedGenders.includes(value)
                      ? selectedGenders.filter(
                          (gender) => gender !== value
                        )
                      : [...selectedGenders, value]
                  );

                  setCurrentIndex(0);
                  setCurrentPhotoIndex(0);
                }}
              />

              {label}
            </label>
          ))}

          <h3>Age</h3>

          {[
            "18-19",
            "19-20",
            "20-21",
            "21-22",
            "23+",
          ].map((age) => (
            <label key={age}>
              <input
                type="checkbox"
                checked={selectedAges.includes(age)}
                onChange={() => {
                  setSelectedAges(
                    selectedAges.includes(age)
                      ? selectedAges.filter(
                          (selectedAge) =>
                            selectedAge !== age
                        )
                      : [...selectedAges, age]
                  );

                  setCurrentIndex(0);
                  setCurrentPhotoIndex(0);
                }}
              />

              {age}
            </label>
          ))}

          <h3>College</h3>

          {[
            "Pomona",
            "Pitzer",
            "Scripps",
            "Harvey Mudd",
            "CMC",
          ].map((college) => (
            <label key={college}>
              <input
                type="checkbox"
                checked={selectedColleges.includes(college)}
                onChange={() => {
                  setSelectedColleges(
                    selectedColleges.includes(college)
                      ? selectedColleges.filter(
                          (selectedCollege) =>
                            selectedCollege !== college
                        )
                      : [
                          ...selectedColleges,
                          college,
                        ]
                  );

                  setCurrentIndex(0);
                  setCurrentPhotoIndex(0);
                }}
              />

              {college}
            </label>
          ))}

          <h3>What are you looking for?</h3>

          {[
            "Short-term",
            "Long-term",
            "Casual",
            "Friends",
            "Not sure",
          ].map((tag) => (
            <label key={tag}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => {
                  setSelectedTags(
                    selectedTags.includes(tag)
                      ? selectedTags.filter(
                          (selectedTag) =>
                            selectedTag !== tag
                        )
                      : [...selectedTags, tag]
                  );

                  setCurrentIndex(0);
                  setCurrentPhotoIndex(0);
                }}
              />

              {tag}
            </label>
          ))}
        </div>
      )}

      <div
        className={`profile-card ${swipeClass}`}
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: isDragging
            ? "none"
            : "transform 0.25s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {currentPhoto ? (
          <div
            className="photo-container"
            onPointerDown={(event) => {
              if (event.target.closest(".photo-nav")) {
                event.stopPropagation();
              }
            }}
          >
            <img
              className="profile-photo"
              src={currentPhoto.photo_url}
              alt={`${profile.display_name}'s profile`}
              draggable="false"
            />

            {profile.photos.length > 1 && (
              <>
                <div className="photo-indicators">
                  {profile.photos.map((photo, index) => (
                    <span
                      key={photo.id}
                      className={
                        index === currentPhotoIndex
                          ? "photo-indicator active"
                          : "photo-indicator"
                      }
                    />
                  ))}
                </div>

                <button
                  className="photo-nav photo-nav-left"
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onPointerUp={(event) =>
                    event.stopPropagation()
                  }
                  onClick={previousPhoto}
                  disabled={currentPhotoIndex === 0}
                >
                  ‹
                </button>

                <button
                  className="photo-nav photo-nav-right"
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onPointerUp={(event) =>
                    event.stopPropagation()
                  }
                  onClick={nextPhoto}
                  disabled={
                    currentPhotoIndex ===
                    profile.photos.length - 1
                  }
                >
                  ›
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="profile-photo-placeholder">
            No Photo
          </div>
        )}

        <div className="profile-info">
          <h1>
            {profile.display_name},{" "}
            {calculateAge(profile.date_of_birth)}
          </h1>

          <p className="school">
            {profile.fiveC}
          </p>

          <p>{profile.gender}</p>

          <p className="bio">
            {profile.bio}
          </p>

          {profile.tags && profile.tags.length > 0 && (
            <div className="profile-tags">
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className="profile-tag"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Swipe buttons */}
        <div
          className="browse-buttons"
          onPointerDown={(event) =>
            event.stopPropagation()
          }
        >
          <button
            className="pass-button"
            onClick={() => swipeCard("left")}
          >
            ❌
          </button>

          <button
            className="like-button"
            onClick={() => swipeCard("right")}
          >
            ❤️
          </button>

          <button
            className="block-button"
            onClick={() => blockProfile(profile)}
          >
            🚫
          </button>
        </div>
      </div>
    </div>
  );
}

export default Browse;