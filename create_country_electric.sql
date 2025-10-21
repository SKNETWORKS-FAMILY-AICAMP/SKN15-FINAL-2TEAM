-- Create country_electric table
-- This SQL can be run directly in DBeaver

DROP TABLE IF EXISTS public.country_electric CASCADE;

CREATE TABLE public.country_electric (
	id serial4 NOT NULL,
	country_name varchar(50) NOT NULL,
	hz varchar(10) NULL,
	voltage varchar(20) NULL,
	plug_type varchar(50) NULL,
	plug_image varchar(255) NULL,
	use_yn bpchar(1) DEFAULT 'N'::bpchar NULL,
	country_code int4 NULL,
	CONSTRAINT country_electric_pkey PRIMARY KEY (id)
);

-- Add foreign key constraint if common_country exists
ALTER TABLE public.country_electric
ADD CONSTRAINT fk_country_electric_country
FOREIGN KEY (country_code)
REFERENCES public.common_country(country_code);

-- Verify table was created
SELECT 'Table created successfully!' as status;
SELECT * FROM pg_tables WHERE tablename = 'country_electric';
