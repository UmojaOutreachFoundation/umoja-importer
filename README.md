# Umoja Importer

One of the things I wanted to include in the new platform was a unified authentication system. Users would be able to create
accounts on the website and subsequently use the same credentials in the mobile app. All the user data would follow them around,
too. This system is called Umoja ID.

However, it would be very inefficient for 1,720 users to need to recreate their accounts on the website. Luckily, Firebase supports
a user import system. Unluckily, Wordpress changed the hashing method for its passwords, so we can't just use the same passwords.
Instead, the import system takes note of the imported user email addresses, adds them to an "imported" collection, and removes them
once they've manually reset their passwords.

## Usage Instructions

1. Clone the repository and run `npm install` to get all of the Node goodness ready.
1. Place the Umoja service account key, called umoja-key.json, up one level from the root directory of the project. _That is, up one level from this README file._
1. Create a folder called "data" in the root directory. Place your `uo_users.csv` and `uo_usermeta.csv` in that folder.
1. All set! Run the application with `npm start` and it will initialize. 🚀

Now, you can use your browser or your favorite REST client to send the GET requests to trigger one of three operations.
- `GET /` returns the status of the application. Wait for this to say OK before proceeding.
- `GET /import` runs the import process on all of the users. Do this with care, because it'll probably destroy everything unless you run it on a completley empty Firebase instance.
- `GET /rollback` speaking of completely empty, this command will destroy all users and delete all collections except for the "imported" collection, which you should delete yourself once this command executes. Note that this command might not work if you have a lot of users, due to a limitation that Firebase imposes, so you might be stuck deleting users yourself.
- `GET /count` returns a count of how many users have been imported.

## License

This software is written by Faizaan Datoo. It is licensed under the GNU General Public License, v3. For more information, check the [LICENSE](LICENSE) file.
