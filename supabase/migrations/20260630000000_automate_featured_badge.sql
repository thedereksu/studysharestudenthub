-- Function to check and update featured badge status
CREATE OR REPLACE FUNCTION update_featured_badge_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the user has at least 3 materials
    IF (SELECT COUNT(*) FROM materials WHERE uploader_id = NEW.uploader_id) >= 3 THEN
        UPDATE profiles
        SET has_featured_badge = true
        WHERE id = NEW.uploader_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function after a new material is posted
CREATE OR REPLACE TRIGGER on_material_posted
AFTER INSERT ON materials
FOR EACH ROW
EXECUTE FUNCTION update_featured_badge_status();

-- Also update existing users who already have 3+ materials
UPDATE profiles
SET has_featured_badge = true
WHERE id IN (
    SELECT uploader_id
    FROM materials
    GROUP BY uploader_id
    HAVING COUNT(*) >= 3
);
