from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_convert_risque_type_to_text"),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE "documents"
                ALTER COLUMN "typeCourrier" TYPE varchar(30) USING "typeCourrier"::text;
            ''',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
