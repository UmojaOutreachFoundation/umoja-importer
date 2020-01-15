# Umoja Importer

One of the things I wanted to include in the new platform was a unified authentication system. Users would be able to create
accounts on the website and subsequently use the same credentials in the mobile app. All the user data would follow them around,
too. This system is called Umoja ID.

However, it would be very inefficient for 1,720 users to need to recreate their accounts on the website. Luckily, Firebase supports
a user import system. Unluckily, Wordpress changed the hashing method for its passwords, so we can't just use the same passwords.
Instead, the import system takes note of the imported user email addresses, adds them to an "imported" collection, and removes them
once they've manually reset their passwords.

This software is written by Faizaan Datoo. It is licensed under the GNU General Public License, v3. For more information, check the [LICENSE](LICENSE) file.
