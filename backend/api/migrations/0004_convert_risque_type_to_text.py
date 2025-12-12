from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_add_telephone_to_utilisateur"),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                ALTER TABLE "risques"
                ALTER COLUMN "type" TYPE varchar(100) USING "type"::text;
            ''',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
